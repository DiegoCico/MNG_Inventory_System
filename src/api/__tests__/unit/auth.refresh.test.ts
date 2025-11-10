import request from 'supertest';
import app from '../../src/server';
import { ensureUserRecord } from '../../src/helpers/awsUsers';
import { decodeJwtNoVerify } from '../../src/helpers/authUtils';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

jest.mock('../../src/helpers/awsUsers', () => ({
  ensureUserRecord: jest.fn(),
}));

jest.mock('../../src/helpers/authUtils', () => ({
  decodeJwtNoVerify: jest.fn(),
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
