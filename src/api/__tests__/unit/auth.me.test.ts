import request from 'supertest';
import { ensureUserRecord } from '../../src/helpers/awsUsers';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

jest.mock('../../src/helpers/awsUsers', () => ({
  ensureUserRecord: jest.fn(),
}));

// Create a mock verify function that persists across tests
const mockVerify = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: mockVerify,
    })),
  },
}));

// Import app AFTER mocks are set up
import app from '../../src/server';

// Utility: check command class in Cognito mock
const isCmd = (cmd: unknown, ctor: any) =>
  Boolean(cmd) && (cmd as any).constructor?.name === ctor.name;

// Spy on Cognito client.send
let cognitoSendSpy: jest.SpyInstance;

beforeAll(() => {
  cognitoSendSpy = jest.spyOn(CognitoIdentityProviderClient.prototype, 'send');
});

afterAll(() => {
  cognitoSendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockClear();
});

describe('Auth Router - me', () => {
  it('returns authenticated true when user is CONFIRMED', async () => {
    mockVerify.mockResolvedValue({
      sub: 'user-123',
      email: 'confirmed@example.com',
      'cognito:username': 'confirmed',
    });

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
    expect(mockVerify).toHaveBeenCalledWith('valid.jwt.token');
  });

  it('returns authenticated false when no cookies at all', async () => {
    const res = await request(app).get('/trpc/me');

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: 'No session',
    });

    // should NOT attempt any verification if no cookies
    expect(mockVerify).not.toHaveBeenCalled();
    expect(cognitoSendSpy).not.toHaveBeenCalled();
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });

  it('returns authenticated false if access token is invalid', async () => {
    mockVerify.mockRejectedValue(new Error('invalid token'));

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
    mockVerify.mockResolvedValue({
      sub: 'user-456',
      email: 'pending@example.com',
      'cognito:username': 'pending',
    });

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
    mockVerify.mockResolvedValue({
      sub: 'user-789',
      email: 'error@example.com',
      'cognito:username': 'error',
    });

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
    mockVerify.mockResolvedValue({
      sub: 'user-999',
      email: 'throw@example.com',
      'cognito:username': 'throw',
    });

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
    mockVerify.mockImplementation(() => {
      throw new Error('sync verify error');
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
      message: expect.stringMatching(/sync verify error/i),
    });
  });
});
