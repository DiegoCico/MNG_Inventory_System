// tests/auth.router.test.ts
import request from 'supertest';
import app from '../../src/server';

import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const isCmd = (cmd: unknown, ctor: any) =>
  Boolean(cmd) && (cmd as any).constructor?.name === ctor.name;

const authResult = () => ({
  AccessToken: 'mock-access-token-123',
  IdToken: 'mock-id-token-abc',
  RefreshToken: 'mock-refresh-token-xyz',
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
        password: 'LongEnoughPwd1!', // >= 12 chars per zod
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

    // Cookies should be set (tRPC adapter returns via headers)
    const setCookie = Array.isArray(res.header['set-cookie'])
      ? res.header['set-cookie'].join(';')
      : res.header['set-cookie'] ?? '';
    expect(setCookie).toContain('auth_access=');
    expect(setCookie).toContain('auth_id=');
    expect(setCookie).toContain('auth_refresh=');
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
        password: 'WrongPassword42!', // meets zod, but backend rejects
      });

    // tRPC formats errors as 500 by default unless you mapped codes
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

    const setCookie = Array.isArray(res.header['set-cookie'])
      ? res.header['set-cookie'].join(';')
      : res.header['set-cookie'] ?? '';
    expect(setCookie).toContain('auth_access=');
    expect(setCookie).toContain('auth_id=');
  });

  it('EMAIL_OTP -> pass-through challenge (still needs code)', async () => {
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
        mfaCode: '123456', // if missing, zod refine would fail
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

  it('zod refine: NEW_PASSWORD_REQUIRED must include newPassword -> 400', async () => {
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
  // TODO Mock JWT Verifier
  // it('returns authenticated true when cookies present', async () => {
  //   const res = await request(app)
  //     .get('/trpc/me')
  //     .set('Cookie', [
  //       'auth_access=a.b.c; Path=/; HttpOnly',
  //       'auth_id=x.y.z; Path=/; HttpOnly',
  //     ]);

  //   expect(res.status).toBe(200);
  //   expect(res.body?.result?.data).toMatchObject({
  //     authenticated: true,
  //   });
  // });

  it('returns authenticated false when no cookies', async () => {
    const res = await request(app).get('/trpc/me');
    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
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
    });
  });

  it('valid refresh token -> sets new cookies & refreshed true', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, InitiateAuthCommand)) {
        return { AuthenticationResult: { ...authResult(), RefreshToken: undefined } };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', ['auth_refresh=refresh123; Path=/; HttpOnly']);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      refreshed: true,
      expiresIn: 3600,
    });

    const setCookie = Array.isArray(res.header['set-cookie'])
      ? res.header['set-cookie'].join(';')
      : res.header['set-cookie'] ?? '';
    expect(setCookie).toContain('auth_access=');
    expect(setCookie).toContain('auth_id=');
    // refresh route typically does not reset refresh cookie; OK either way
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
    });

    // Expect cookies cleared (implementation-specific names; assert presence)
    const setCookie = Array.isArray(res.header['set-cookie'])
      ? res.header['set-cookie'].join(';')
      : res.header['set-cookie'] ?? '';
    expect(setCookie).toContain('auth_access=');
    expect(setCookie).toContain('auth_id=');
    expect(setCookie).toContain('auth_refresh=');
  });
});
