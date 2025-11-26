import request from 'supertest';
import app from '../src/server';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const isCmd = (cmd: unknown, ctor: any) =>
  Boolean(cmd) && (cmd as any).constructor?.name === ctor.name;

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
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, InitiateAuthCommand)) {
        return {
          AuthenticationResult: authResult(),
        };
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=valid-refresh-token-123');

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      accessToken: 'new-access-token-456',
      idToken: 'new-id-token-789',
      refreshToken: 'new-refresh-token-012',
    });

    // Verify new cookies are set
    const setCookieHeader = res.header['set-cookie'];
    const setCookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');

    expect(setCookieStr).toContain('auth_access=');
    expect(setCookieStr).toContain('auth_id=');
    expect(setCookieStr).toContain('auth_refresh=');
  });

  it('returns 401 when no refresh token provided', async () => {
    const res = await request(app).post('/trpc/refresh');

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('No refresh token');
  });

  it('returns 401 when refresh token is invalid', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, InitiateAuthCommand)) {
        const err: any = new Error('Invalid refresh token');
        err.name = 'NotAuthorizedException';
        throw err;
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=invalid-token');

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('Invalid refresh token');
  });

  it('returns 401 when refresh token is expired', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, InitiateAuthCommand)) {
        const err: any = new Error('Refresh token expired');
        err.name = 'NotAuthorizedException';
        throw err;
      }
      return {};
    });

    const res = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=expired-token');

    expect(res.status).toBe(401);
  });

  it('handles Cognito service errors gracefully', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, InitiateAuthCommand)) {
        throw new Error('Cognito service unavailable');
      }
      return {};
    });

    const res = await request(app).post('/trpc/refresh').set('Cookie', 'auth_refresh=valid-token');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).toContain('Failed to refresh tokens');
  });

  it('verifies REFRESH_TOKEN auth flow is used', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, InitiateAuthCommand)) {
        const input = (command as any).input;
        expect(input.AuthFlow).toBe('REFRESH_TOKEN_AUTH');
        expect(input.AuthParameters.REFRESH_TOKEN).toBe('valid-refresh-token');

        return { AuthenticationResult: authResult() };
      }
      return {};
    });

    await request(app).post('/trpc/refresh').set('Cookie', 'auth_refresh=valid-refresh-token');

    expect(cognitoSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
        }),
      }),
    );
  });

  it('handles refresh token rotation correctly', async () => {
    const firstRefresh = authResult();
    const secondRefresh = {
      ...authResult(),
      AccessToken: 'second-access-token',
      RefreshToken: 'second-refresh-token',
    };

    cognitoSendSpy
      .mockResolvedValueOnce({ AuthenticationResult: firstRefresh })
      .mockResolvedValueOnce({ AuthenticationResult: secondRefresh });

    // First refresh
    const res1 = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=original-token');

    expect(res1.status).toBe(200);
    expect(res1.body?.result?.data?.refreshToken).toBe('new-refresh-token-012');

    // Second refresh with new token
    const res2 = await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=new-refresh-token-012');

    expect(res2.status).toBe(200);
    expect(res2.body?.result?.data?.refreshToken).toBe('second-refresh-token');
  });

  it('parses refresh token from cookie header correctly', async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, InitiateAuthCommand)) {
        const token = (command as any).input.AuthParameters.REFRESH_TOKEN;
        expect(token).toBe('token-from-cookie');
        return { AuthenticationResult: authResult() };
      }
      return {};
    });

    await request(app)
      .post('/trpc/refresh')
      .set('Cookie', 'auth_refresh=token-from-cookie; Path=/; HttpOnly');

    expect(cognitoSendSpy).toHaveBeenCalled();
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

  it('returns tokens with correct structure and types', async () => {
    cognitoSendSpy.mockResolvedValue({
      AuthenticationResult: authResult(),
    });

    const res = await request(app).post('/trpc/refresh').set('Cookie', 'auth_refresh=valid-token');

    const data = res.body?.result?.data;
    expect(data).toMatchObject({
      success: true,
      accessToken: expect.any(String),
      idToken: expect.any(String),
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: expect.any(Number),
    });

    expect(data.expiresIn).toBeGreaterThan(0);
  });
});
