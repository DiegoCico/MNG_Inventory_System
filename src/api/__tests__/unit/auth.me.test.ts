import request from 'supertest';
import app from '../../src/server';
import { ensureUserRecord } from '../../src/helpers/awsUsers';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

jest.mock('../../src/helpers/awsUsers', () => ({
  ensureUserRecord: jest.fn(),
}));

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(),
    })),
  },
}));

// Utility: check command class in Cognito mock
const isCmd = (cmd: unknown, ctor: any) =>
  Boolean(cmd) && (cmd as any).constructor?.name === ctor.name;

// Helper to get the mocked verifier instance
const getMockedVerifier = () => {
  const mockCreate = CognitoJwtVerifier.create as jest.Mock;
  // Get the latest call result (in case create is called multiple times)
  const results = mockCreate.mock.results;
  return results[results.length - 1]?.value;
};

// We'll stub client.send on Cognito
let cognitoSendSpy: jest.SpyInstance;

beforeAll(() => {
  cognitoSendSpy = jest.spyOn(CognitoIdentityProviderClient.prototype, 'send');
});

afterAll(() => {
  cognitoSendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  // Don't clear the mocks on CognitoJwtVerifier.create itself, as that would break the verifier instance
  // But DO clear any previous mock behaviors on the verify method
  const verifier = getMockedVerifier();
  if (verifier && verifier.verify) {
    verifier.verify.mockClear();
  }
});

describe('Auth Router - me', () => {
  const mockedVerifier = getMockedVerifier();

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear call history but don't reset the mock implementation
    if (mockedVerifier && mockedVerifier.verify) {
      mockedVerifier.verify.mockClear();
    }
    (ensureUserRecord as jest.Mock).mockClear();
  });

  it('returns authenticated true when user is CONFIRMED', async () => {
    if (mockedVerifier && mockedVerifier.verify) {
      mockedVerifier.verify.mockResolvedValue({
        sub: 'user-123',
        email: 'confirmed@example.com',
        'cognito:username': 'confirmed',
      });
    }

    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        return {
          UserStatus: 'CONFIRMED',
          UserAttributes: [
            { Name: 'email', Value: 'confirmed@example.com' },
            { Name: 'sub', Value: 'user-123' },
          ],
        };
      }
      return {};
    });

    (ensureUserRecord as jest.Mock).mockResolvedValue({
      sub: 'user-123',
      email: 'confirmed@example.com',
      accountId: 'acc-confirmed-me-123',
    });

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', [
        'auth_access=valid.jwt.token; Path=/; HttpOnly',
        'auth_id=x.y.z; Path=/; HttpOnly',
      ]);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: true,
      message: 'User session verified',
      userId: 'user-123',
      email: 'confirmed@example.com',
      accountId: 'acc-confirmed-me-123',
    });
    expect(mockedVerifier.verify).toHaveBeenCalledWith('valid.jwt.token');
  });

  it('returns authenticated false when no cookies at all', async () => {
    const res = await request(app).get('/trpc/me');

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: 'No session',
    });

    // should NOT attempt any verification if no cookies
    expect(cognitoSendSpy).not.toHaveBeenCalled();
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });

  it('returns authenticated false if access token is invalid', async () => {
    if (mockedVerifier && mockedVerifier.verify) {
      mockedVerifier.verify.mockRejectedValue(new Error('invalid token'));
    }

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', [
        'auth_access=invalid.jwt.token; Path=/; HttpOnly',
        'auth_id=x.y.z; Path=/; HttpOnly',
      ]);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: expect.stringMatching(/invalid token/i),
    });
  });

  it('returns authenticated false if Cognito user is not CONFIRMED', async () => {
    if (mockedVerifier && mockedVerifier.verify) {
      mockedVerifier.verify.mockResolvedValue({
        sub: 'user-456',
        email: 'pending@example.com',
        'cognito:username': 'pending',
      });
    }

    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        return {
          UserStatus: 'UNCONFIRMED',
          UserAttributes: [
            { Name: 'email', Value: 'pending@example.com' },
            { Name: 'sub', Value: 'user-456' },
          ],
        };
      }
      return {};
    });

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', [
        'auth_access=valid.jwt.token; Path=/; HttpOnly',
        'auth_id=x.y.z; Path=/; HttpOnly',
      ]);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: expect.stringMatching(/requires attention|UNCONFIRMED/i),
    });
  });

  it('returns authenticated false and message if ensureUserRecord throws', async () => {
    if (mockedVerifier && mockedVerifier.verify) {
      mockedVerifier.verify.mockResolvedValue({
        sub: 'user-789',
        email: 'error@example.com',
        'cognito:username': 'error',
      });
    }

    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        return {
          UserStatus: 'CONFIRMED',
          UserAttributes: [
            { Name: 'email', Value: 'error@example.com' },
            { Name: 'sub', Value: 'user-789' },
          ],
        };
      }
      return {};
    });

    (ensureUserRecord as jest.Mock).mockRejectedValue(new Error('dynamo error'));

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', [
        'auth_access=valid.jwt.token; Path=/; HttpOnly',
        'auth_id=x.y.z; Path=/; HttpOnly',
      ]);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: expect.stringMatching(/dynamo error/i),
    });
  });

  it('returns authenticated false if AdminGetUserCommand throws', async () => {
    if (mockedVerifier && mockedVerifier.verify) {
      mockedVerifier.verify.mockResolvedValue({
        sub: 'user-999',
        email: 'throw@example.com',
        'cognito:username': 'throw',
      });
    }

    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        throw new Error('cognito down');
      }
      return {};
    });

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', [
        'auth_access=valid.jwt.token; Path=/; HttpOnly',
        'auth_id=x.y.z; Path=/; HttpOnly',
      ]);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: expect.stringMatching(/cognito down/i),
    });
  });

  it('returns authenticated false if verify throws synchronously', async () => {
    if (mockedVerifier && mockedVerifier.verify) {
      mockedVerifier.verify.mockImplementation(() => {
        throw new Error('sync verify error');
      });
    }

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', [
        'auth_access=valid.jwt.token; Path=/; HttpOnly',
        'auth_id=x.y.z; Path=/; HttpOnly',
      ]);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: expect.stringMatching(/sync verify error/i),
    });
  });
});
