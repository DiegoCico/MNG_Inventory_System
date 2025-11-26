import request from 'supertest';
import app from '../src/server';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

// Utility: check command class in mock
const isCmd = (cmd: unknown, ctor: any) =>
  Boolean(cmd) && (cmd as any).constructor?.name === ctor.name;

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

  // Default SES mock - always succeeds
  sesSendSpy.mockImplementation(async (command: any) => {
    if (isCmd(command, SendEmailCommand)) {
      return { MessageId: 'mock-message-id-123' };
    }
    return {};
  });
});

describe('Auth Router - inviteUser', () => {
  it('creates new user and sends invite email -> 200 success', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        // User doesn't exist
        const err: any = new Error('User not found');
        err.name = 'UserNotFoundException';
        throw err;
      }
      if (isCmd(command, AdminCreateUserCommand)) {
        return {
          User: {
            Username: 'newuser@example.com',
            UserStatus: 'FORCE_CHANGE_PASSWORD',
          },
        };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({
        email: 'newuser@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      userEmail: 'newuser@example.com',
      message: expect.stringContaining('User invited successfully'),
    });

    // Verify Cognito was called
    expect(cognitoSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Username: 'newuser@example.com',
        }),
      }),
    );

    // Verify SES email was sent
    expect(sesSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Destination: expect.objectContaining({
            ToAddresses: ['newuser@example.com'],
          }),
        }),
      }),
    );
  });

  it('re-invites existing user with new password -> 200 success', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        // User exists
        return {
          Username: 'existing@example.com',
          UserStatus: 'CONFIRMED',
        };
      }
      if (isCmd(command, AdminSetUserPasswordCommand)) {
        return {};
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({
        email: 'existing@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      userEmail: 'existing@example.com',
    });

    // Verify password was reset
    expect(cognitoSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Password: expect.any(String),
          Permanent: false,
        }),
      }),
    );
  });

  it('invalid email format -> 400 validation error', async () => {
    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({
        email: 'not-an-email',
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('Invalid');
  });

  it('missing email field -> 400 validation error', async () => {
    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(400);
  });

  it('UsernameExistsException during create -> 409 conflict', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        const err: any = new Error('User not found');
        err.name = 'UserNotFoundException';
        throw err;
      }
      if (isCmd(command, AdminCreateUserCommand)) {
        const err: any = new Error('Username exists');
        err.name = 'UsernameExistsException';
        throw err;
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({
        email: 'duplicate@example.com',
      });

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('already exists');
  });

  it('InvalidParameterException -> 400 bad request', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        const err: any = new Error('User not found');
        err.name = 'UserNotFoundException';
        throw err;
      }
      if (isCmd(command, AdminCreateUserCommand)) {
        const err: any = new Error('Invalid parameter');
        err.name = 'InvalidParameterException';
        throw err;
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({
        email: 'invalid@example.com',
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('Invalid');
  });

  it('SES email send failure -> 500 internal error', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        const err: any = new Error('User not found');
        err.name = 'UserNotFoundException';
        throw err;
      }
      if (isCmd(command, AdminCreateUserCommand)) {
        return { User: { Username: 'test@example.com' } };
      }
      return {};
    });

    sesSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, SendEmailCommand)) {
        throw new Error('SES service unavailable');
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/inviteUser')
      .set('Content-Type', 'application/json')
      .send({
        email: 'test@example.com',
      });

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).toContain('Failed to invite user');
  });

  it('generates valid temporary password with required complexity', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        const err: any = new Error('User not found');
        err.name = 'UserNotFoundException';
        throw err;
      }
      if (isCmd(command, AdminCreateUserCommand)) {
        const password = (command as any).input.TemporaryPassword;

        // Verify password meets Cognito requirements
        expect(password).toMatch(/[A-Z]/); // uppercase
        expect(password).toMatch(/[a-z]/); // lowercase
        expect(password).toMatch(/[0-9]/); // number
        expect(password).toMatch(/[^A-Za-z0-9]/); // special char
        expect(password.length).toBeGreaterThanOrEqual(12);

        return { User: { Username: 'test@example.com' } };
      }
      return {};
    });

    await request(app).post('/trpc/inviteUser').set('Content-Type', 'application/json').send({
      email: 'test@example.com',
    });

    expect(cognitoSendSpy).toHaveBeenCalled();
  });
});
