import request from 'supertest';
import app from '../src/server';
import {
  CognitoIdentityProviderClient,
  AdminRespondToAuthChallengeCommand,
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

  it('CodeMismatchException -> 400 with "Invalid code"', async () => {
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

    expect(res.status).toBe(400);
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
