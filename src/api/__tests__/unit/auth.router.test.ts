import request from 'supertest';
import app from '../../src/server';

import {
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const authResult = () => ({
  AccessToken: 'mock-access-token-123',
  IdToken: 'mock-id-token-abc',
  RefreshToken: 'mock-refresh-token-xyz',
  TokenType: 'Bearer',
  ExpiresIn: 3600,
});

const isCmd = (cmd: unknown, name: string) =>
  Boolean(cmd) && (cmd as any).constructor?.name === name;

let cognitoSendSpy: jest.SpyInstance;
let sesSendSpy: jest.SpyInstance;

beforeAll(() => {
  cognitoSendSpy = jest.spyOn(CognitoIdentityProviderClient.prototype, 'send');

  sesSendSpy = jest.spyOn(SESv2Client.prototype, 'send');
});

afterAll(() => {
  cognitoSendSpy.mockRestore();
  sesSendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Auth Router - inviteUser', () => {
  it('invites NEW user: AdminGetUser -> UserNotFoundException, then AdminCreateUser, then SES email (200)', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, 'AdminGetUserCommand')) {
        const err = new Error('No such user');
        (err as any).name = 'UserNotFoundException';
        throw err;
      }
      if (isCmd(command, 'AdminCreateUserCommand')) {
        return {}; // ok
      }
      return {};
    });

    sesSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, 'SendEmailCommand')) {
        return {}; // ok
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      userEmail: 'test@example.com',
      message: 'User invited successfully - a custom SES email with credentials was sent.',
    });

    expect(cognitoSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, 'AdminGetUserCommand'))).toBe(true);
    expect(cognitoSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, 'AdminCreateUserCommand'))).toBe(
      true,
    );
    expect(sesSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, 'SendEmailCommand'))).toBe(true);
  });

  it('re-invites EXISTING user: AdminGetUser OK, AdminSetUserPassword OK, SES email OK (200)', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, 'AdminGetUserCommand')) {
        return { Username: 'existing@example.com' }; // user exists
      }
      if (isCmd(command, 'AdminSetUserPasswordCommand')) {
        return {}; // ok
      }
      return {};
    });

    sesSendSpy.mockResolvedValue({});

    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({ email: 'existing@example.com' });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      userEmail: 'existing@example.com',
    });

    expect(cognitoSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, 'AdminGetUserCommand'))).toBe(true);
    expect(
      cognitoSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, 'AdminSetUserPasswordCommand')),
    ).toBe(true);
    expect(sesSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, 'SendEmailCommand'))).toBe(true);
  });

  it('invalid email -> 400 from Zod', async () => {
    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });
});

describe('Auth Router - signIn', () => {
  it('first-time login challenge -> 200 with NEW_PASSWORD_REQUIRED', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, 'AdminInitiateAuthCommand')) {
        return {
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          Session: 'mock-session-token-12345',
          ChallengeParameters: {},
        };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/signIn')
      .set('Content-Type', 'application/json')
      .send({
        email: 'test@example.com',
        // router requires min 12 chars:
        password: 'TempPassword1!',
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: false,
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session: 'mock-session-token-12345',
    });
  });

  it('successful authentication -> sends MFA code instead of immediate tokens', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, 'AdminInitiateAuthCommand')) {
        return {
          AuthenticationResult: authResult(),
        };
      }
      return {};
    });

    // Mock SES send for MFA email
    sesSendSpy.mockResolvedValue({ MessageId: 'mock-message-id' });

    const res = await request(app)
      .post('/trpc/signIn')
      .set('Content-Type', 'application/json')
      .send({
        email: 'test@example.com',
        password: 'ValidPassword12!',
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: false,
      challengeName: 'CUSTOM_EMAIL_MFA',
      mfaSessionId: expect.any(String),
      message: 'MFA code sent to your email',
    });

    // Verify MFA email was sent
    expect(sesSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          FromEmailAddress: expect.any(String),
          Destination: { ToAddresses: ['test@example.com'] },
        }),
      }),
    );
  });
});

describe('Auth Router - respondToChallenge', () => {
  it('completes NEW_PASSWORD_REQUIRED and sends MFA code (200)', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, 'AdminRespondToAuthChallengeCommand')) {
        return {
          AuthenticationResult: authResult(),
        };
      }
      return {};
    });

    // Mock SES send for MFA email
    sesSendSpy.mockResolvedValue({ MessageId: 'mock-message-id' });

    const res = await request(app)
      .post('/trpc/respondToChallenge')
      .set('Content-Type', 'application/json')
      .send({
        challengeName: 'NEW_PASSWORD_REQUIRED',
        session: 'mock-session',
        newPassword: 'NewPassword123!',
        email: 'test@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: false,
      challengeName: 'CUSTOM_EMAIL_MFA',
      mfaSessionId: expect.any(String),
      message: 'Password updated. MFA code sent to your email.',
    });

    // Verify MFA email was sent
    expect(sesSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          FromEmailAddress: expect.any(String),
          Destination: { ToAddresses: ['test@example.com'] },
        }),
      }),
    );
  });
});
