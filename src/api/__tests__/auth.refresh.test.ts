import request from 'supertest';
import app from '../src/server';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

// Mock ensureUserRecord
jest.mock('../src/helpers/awsUsers', () => ({
  ensureUserRecord: jest.fn().mockResolvedValue({
    username: 'test-user',
    accountId: 'acc-123',
  }),
}));

// Mock decodeJwtNoVerify
jest.mock('../src/helpers/authUtils', () => ({
  decodeJwtNoVerify: jest.fn(() => ({ sub: 'user-123' })),
}));

// Type for command objects we receive in mock
interface MockableCommand {
  constructor: { name: string };
  input: Record<string, unknown>;
}

// Type-safe command name checker
function isCommandNamed(cmd: MockableCommand, name: string): boolean {
  return cmd.constructor.name === name;
}

class CognitoError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

const authResult = () => ({
  AccessToken: 'new-access-token-456',
  IdToken: 'new-id-token-789',
  RefreshToken: 'new-refresh-token-012',
  TokenType: 'Bearer',
  ExpiresIn: 3600,
});

let cognitoSendSpy: jest.SpyInstance;

beforeAll(() => {
  cognitoSendSpy = jest.spyOn(CognitoIdentityProviderClient.prototype, 'send');
});

afterAll(() => {
  cognitoSendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Auth Router - refresh', () => {
  it('refreshes tokens successfully with valid refresh token', async () => {
    cognitoSendSpy.mockImplementation(async (command: MockableCommand) => {
      if (isCommandNamed(command, 'InitiateAuthCommand')) {
        return { AuthenticationResult: authResult() };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=valid-refresh-token-123');

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      refreshed: true,
      userId: 'user-123',
      username: 'test-user',
      accountId: 'acc-123',
      authenticated: true,
      expiresIn: 3600,
    });

    // Verify new cookies are set
    const setCookieHeader = res.header['set-cookie'];
    const setCookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');

    expect(setCookieStr).toContain('auth_access=');
    expect(setCookieStr).toContain('auth_id=');
  });

  it('returns 401 when no refresh token provided', async () => {
    const res = await request(app).post('/trpc/refresh');

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('No refresh token');
  });

  it('returns 401 when refresh token is invalid', async () => {
    cognitoSendSpy.mockImplementation(async (command: MockableCommand) => {
      if (isCommandNamed(command, 'InitiateAuthCommand')) {
        throw new CognitoError('NotAuthorizedException', 'Invalid refresh token');
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=invalid-token');

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('Invalid or expired refresh token');
  });

  it('returns 401 when refresh token is expired', async () => {
    cognitoSendSpy.mockImplementation(async (command: MockableCommand) => {
      if (isCommandNamed(command, 'InitiateAuthCommand')) {
        throw new CognitoError('NotAuthorizedException', 'Refresh token expired');
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=expired-token');

    expect(res.status).toBe(401);
  });

  it('handles Cognito service errors gracefully', async () => {
    cognitoSendSpy.mockImplementation(async (command: MockableCommand) => {
      if (isCommandNamed(command, 'InitiateAuthCommand')) {
        throw new Error('Cognito service unavailable');
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=valid-token');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).toContain('Token refresh failed');
  });

  it('verifies REFRESH_TOKEN auth flow is used', async () => {
    cognitoSendSpy.mockImplementation(async (command: MockableCommand) => {
      if (isCommandNamed(command, 'InitiateAuthCommand')) {
        return { AuthenticationResult: authResult() };
      }
      return {};
    });

    await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=valid-refresh-token');

    expect(cognitoSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          AuthParameters: expect.objectContaining({
            REFRESH_TOKEN: 'valid-refresh-token',
          }),
        }),
      }),
    );
  });

  it('parses refresh token from cookie header correctly', async () => {
    cognitoSendSpy.mockImplementation(async (command: MockableCommand) => {
      if (isCommandNamed(command, 'InitiateAuthCommand')) {
        return { AuthenticationResult: authResult() };
      }
      return {};
    });

    await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=token-from-cookie; Path=/; HttpOnly');

    expect(cognitoSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          AuthParameters: expect.objectContaining({
            REFRESH_TOKEN: 'token-from-cookie',
          }),
        }),
      }),
    );
  });

  it('handles multiple cookies in header', async () => {
    cognitoSendSpy.mockResolvedValue({
      AuthenticationResult: authResult(),
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'other_cookie=value; auth_refresh=correct-token; another=data');

    expect(res.status).toBe(200);
  });

  it('returns response with correct structure', async () => {
    cognitoSendSpy.mockResolvedValue({
      AuthenticationResult: authResult(),
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=valid-token');

    const data = res.body?.result?.data;
    expect(data).toMatchObject({
      refreshed: true,
      userId: expect.any(String),
      username: expect.any(String),
      accountId: expect.any(String),
      authenticated: true,
      expiresIn: expect.any(Number),
    });

    expect(data.expiresIn).toBeGreaterThan(0);
  });

  it('returns 401 when AuthenticationResult is missing', async () => {
    cognitoSendSpy.mockResolvedValue({
      AuthenticationResult: null,
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=valid-token');

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('Token refresh failed');
  });
});