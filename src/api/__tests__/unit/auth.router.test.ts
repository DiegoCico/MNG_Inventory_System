import request from 'supertest';
import app from '../../src/server';
import { ensureUserRecord } from '../../src/helpers/awsUsers';
import { decodeJwtNoVerify } from '../../src/helpers/authUtils';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

jest.mock('../../src/helpers/awsUsers', () => ({
  ensureUserRecord: jest.fn(),
}));

jest.mock('../../src/helpers/authUtils', () => ({
  decodeJwtNoVerify: jest.fn(),
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

// Fake tokens Cognito would return in AuthenticationResult
const authResult = () => ({
  AccessToken: 'mock-access-token-123',
  IdToken: 'mock-id-token-abc',
  RefreshToken: 'mock-refresh-token-xyz',
  TokenType: 'Bearer',
  ExpiresIn: 3600,
});

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

/* -------------------------------------------------------------------------- */
/*                                   signIn                                    */
/* -------------------------------------------------------------------------- */
describe('Auth Router - signIn', () => {
  it('NEW_PASSWORD_REQUIRED challenge -> 200 payload with session', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminInitiateAuthCommand)) {
        return {
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          ChallengeParameters: { userId: 'abc' },
          Session: 'sess-123',
        };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/signIn')
      .set('Content-Type', 'application/json')
      .send({
        email: 'firstlogin@example.com',
        password: 'LongEnoughPwd1!', // >=12 chars per zod
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: false,
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session: 'sess-123',
    });
  });

  it('EMAIL_OTP challenge -> 200 payload with session', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminInitiateAuthCommand)) {
        return {
          ChallengeName: 'EMAIL_OTP',
          ChallengeParameters: { medium: 'email' },
          Session: 'otp-session-xyz',
        };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/signIn')
      .set('Content-Type', 'application/json')
      .send({
        email: 'otpuser@example.com',
        password: 'StrongPassword42!',
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: false,
      challengeName: 'EMAIL_OTP',
      session: 'otp-session-xyz',
    });
  });

  it('successful auth -> sets cookies & returns tokens', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminInitiateAuthCommand)) {
        return {
          AuthenticationResult: authResult(),
        };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/signIn')
      .set('Content-Type', 'application/json')
      .send({
        email: 'ok@example.com',
        password: 'VerySecurePwd12!',
      });

    expect(res.status).toBe(200);
    const data = res.body?.result?.data;
    expect(data).toMatchObject({
      success: true,
      accessToken: expect.any(String),
      idToken: expect.any(String),
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 3600,
    });

    // Cookies should be set by setAuthCookies -> verify headers
    const setCookieHeader = res.header['set-cookie'];
    const setCookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');

    expect(setCookieStr).toContain('auth_access=');
    expect(setCookieStr).toContain('auth_id=');
    expect(setCookieStr).toContain('auth_refresh=');
  });

  it('NotAuthorizedException -> 500 with friendly error message', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminInitiateAuthCommand)) {
        const err: any = new Error('bad creds');
        err.name = 'NotAuthorizedException';
        throw err;
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/signIn')
      .set('Content-Type', 'application/json')
      .send({
        email: 'bad@example.com',
        password: 'WrongPassword42!', // valid length, but rejected
      });

    // tRPC default error is 500 unless you're mapping codes
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).toContain('Invalid email or password');
  });

  it('short password -> Zod 400', async () => {
    const res = await request(app)
      .post('/trpc/signIn')
      .set('Content-Type', 'application/json')
      .send({
        email: 'test@example.com',
        password: 'short', // < 12
      });

    expect(res.status).toBe(400);
  });
});

/* -------------------------------------------------------------------------- */
/*                            respondToChallenge                               */
/* -------------------------------------------------------------------------- */
describe('Auth Router - respondToChallenge', () => {
  it('NEW_PASSWORD_REQUIRED -> success auth -> sets cookies (200)', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminRespondToAuthChallengeCommand)) {
        return { AuthenticationResult: authResult() };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/respondToChallenge')
      .set('Content-Type', 'application/json')
      .send({
        challengeName: 'NEW_PASSWORD_REQUIRED',
        session: 'sess-abc',
        newPassword: 'BrandNewPass12!',
        email: 'change@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      message: 'Password updated and sign in successful',
      accessToken: expect.any(String),
      idToken: expect.any(String),
      refreshToken: expect.any(String),
    });

    const setCookieHeader = res.header['set-cookie'];
    const setCookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');
    expect(setCookieStr).toContain('auth_access=');
    expect(setCookieStr).toContain('auth_id=');
  });

  it('EMAIL_OTP -> still needs code (a second step required)', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminRespondToAuthChallengeCommand)) {
        return {
          ChallengeName: 'EMAIL_OTP',
          ChallengeParameters: { medium: 'email' },
          Session: 'sess-next',
        };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/respondToChallenge')
      .set('Content-Type', 'application/json')
      .send({
        challengeName: 'EMAIL_OTP',
        session: 'otp-sess',
        mfaCode: '123456',
        email: 'mfa@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: false,
      challengeName: 'EMAIL_OTP',
      session: 'sess-next',
    });
  });

  it('CodeMismatchException -> 500 with "Invalid code"', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminRespondToAuthChallengeCommand)) {
        const err: any = new Error('bad code');
        err.name = 'CodeMismatchException';
        throw err;
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/respondToChallenge')
      .set('Content-Type', 'application/json')
      .send({
        challengeName: 'EMAIL_OTP',
        session: 'otp-sess',
        mfaCode: '000000',
        email: 'mfa@example.com',
      });

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).toContain('Invalid code');
  });

  it('zod refine: NEW_PASSWORD_REQUIRED without newPassword -> 400', async () => {
    const res = await request(app)
      .post('/trpc/respondToChallenge')
      .set('Content-Type', 'application/json')
      .send({
        challengeName: 'NEW_PASSWORD_REQUIRED',
        session: 'sess-x',
        // newPassword missing
        email: 'change@example.com',
      });

    expect(res.status).toBe(400);
  });
});

/* -------------------------------------------------------------------------- */
/*                                   me                                        */
/* -------------------------------------------------------------------------- */
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
    expect(decodeJwtNoVerify).not.toHaveBeenCalled();
    expect(cognitoSendSpy).not.toHaveBeenCalled();
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });
});

describe('Auth Router - me (additional)', () => {
  const mockedVerifier = getMockedVerifier();

  beforeEach(() => {
    jest.clearAllMocks();
    if (mockedVerifier && mockedVerifier.verify) {
      mockedVerifier.verify.mockClear();
    }
    (ensureUserRecord as jest.Mock).mockClear();
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

/* -------------------------------------------------------------------------- */
/*                                 refresh                                     */
/* -------------------------------------------------------------------------- */
describe('Auth Router - refresh', () => {
  it('no refresh token cookie -> refreshed false (200)', async () => {
    const res = await request(app).post('/trpc/refresh');

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      refreshed: false,
      message: 'No refresh token',
    });

    // no downstream calls
    expect(cognitoSendSpy).not.toHaveBeenCalled();
    expect(decodeJwtNoVerify).not.toHaveBeenCalled();
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });

  it('valid refresh token -> rotates cookies, upserts user, returns refreshed true + account', async () => {
    // Cognito returns new AccessToken/IdToken/ExpiresIn on refresh
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, InitiateAuthCommand)) {
        return {
          AuthenticationResult: {
            ...authResult(),
            RefreshToken: undefined, // usually not re-issued
          },
        };
      }
      return {};
    });

    // After refresh, router decodes newId/newAccess → we mock that decode
    (decodeJwtNoVerify as jest.Mock).mockReturnValue({
      sub: 'user-sub-999',
      email: 'afterRefresh@example.com',
    });

    // Then it calls ensureUserRecord
    (ensureUserRecord as jest.Mock).mockResolvedValue({
      sub: 'user-sub-999',
      email: 'afterRefresh@example.com',
      accountId: 'acc-after-refresh-7777',
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', ['auth_refresh=refresh123; Path=/; HttpOnly']);

    expect(res.status).toBe(200);

    // Cognito refresh flow was called
    expect(cognitoSendSpy).toHaveBeenCalled();
    expect(isCmd(cognitoSendSpy.mock.calls[0][0], InitiateAuthCommand)).toBe(true);

    // We should have decoded the new token
    expect(decodeJwtNoVerify).toHaveBeenCalled();

    // We should have ensured the user exists in Dynamo
    expect(ensureUserRecord).toHaveBeenCalledWith({
      sub: 'user-sub-999',
      email: 'afterRefresh@example.com',
    });

    // Response body
    expect(res.body?.result?.data).toMatchObject({
      refreshed: true,
      expiresIn: 3600,
      sub: 'user-sub-999',
      email: 'afterRefresh@example.com',
      accountId: 'acc-after-refresh-7777',
    });

    // Cookies should get rotated for access/id
    const setCookieHeader = res.header['set-cookie'];
    const setCookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');

    expect(setCookieStr).toContain('auth_access=');
    expect(setCookieStr).toContain('auth_id=');
    // refresh cookie may or may not be updated; not required here
  });

  it('refresh token exists but Cognito returns no AuthenticationResult -> refreshed false', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, InitiateAuthCommand)) {
        return {
          // no AuthenticationResult
        };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', ['auth_refresh=refresh123; Path=/; HttpOnly']);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      refreshed: false,
      message: 'Token refresh failed',
    });

    // decodeJwtNoVerify should NOT be called since no tokens
    expect(decodeJwtNoVerify).not.toHaveBeenCalled();
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/*                                  logout                                     */
/* -------------------------------------------------------------------------- */
describe('Auth Router - logout', () => {
  it('clears cookies and returns success', async () => {
    const res = await request(app)
      .post('/trpc/logout')
      .set('Cookie', [
        'auth_access=a; Path=/; HttpOnly',
        'auth_id=b; Path=/; HttpOnly',
        'auth_refresh=c; Path=/; HttpOnly',
      ]);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      message: 'Signed out',
    });

    // we expect clearing cookies to write Set-Cookie headers
    const setCookieHeader = res.header['set-cookie'];
    const setCookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');
    expect(setCookieStr).toContain('auth_access=');
    expect(setCookieStr).toContain('auth_id=');
    expect(setCookieStr).toContain('auth_refresh=');
  });
});
