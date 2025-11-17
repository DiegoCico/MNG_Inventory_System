import request from 'supertest';
import app from '../src/server';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

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
});

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
