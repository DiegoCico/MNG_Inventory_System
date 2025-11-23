// Mock Cognito verifier and permissions lookup so tests run without real tokens
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(async (_token: string) => ({
        sub: 'test-user-id',
        'cognito:username': 'testuser',
        email: 'test@example.com',
      })),
    })),
  },
}));

jest.mock('../src/helpers/teamspaceHelpers', () => ({
  getUserPermissions: jest.fn(async (_sub: string) => ({
    roleName: 'OWNER',
    permissions: [
      'team.create',
      'team.add_member',
      'team.remove_member',
      'team.view',
      'team.delete',
      'role.add',
      'role.modify',
      'role.remove',
      'role.view',
      'user.invite',
      'user.delete',
      'user.assign_roles',
      'item.create',
      'item.view',
      'item.update',
      'item.delete',
      'item.reset',
      'reports.create',
      'reports.view',
      'reports.delete',
    ],
  })),
}));

import request from 'supertest';
import app from '../src/server';

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
