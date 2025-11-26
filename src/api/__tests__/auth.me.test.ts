// Mock JWT verifier BEFORE imports
const mockVerify = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: mockVerify,
    })),
  },
}));

// Now import modules that depend on the mock
import request from 'supertest';
import app from '../src/server';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// Mock DynamoDB
let docSendSpy: jest.SpyInstance;

beforeAll(() => {
  docSendSpy = jest.spyOn(DynamoDBDocumentClient.prototype, 'send');
});

afterAll(() => {
  docSendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const isCmd = (cmd: unknown, ctor: any) =>
  Boolean(cmd) && (cmd as any).constructor?.name === ctor.name;

describe('Auth Router - me', () => {
  it('returns user profile when authenticated with valid token', async () => {
    // Mock JWT verification
    mockVerify.mockResolvedValue({
      sub: 'user-123',
      'cognito:username': 'testuser',
      email: 'test@example.com',
    });

    // Mock DynamoDB user lookup
    docSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, GetCommand)) {
        return {
          Item: {
            PK: 'USER#user-123',
            SK: 'METADATA',
            sub: 'user-123',
            name: 'Test User',
            username: 'testuser',
            role: 'admin',
            accountId: 'acc-456',
          },
        };
      }
      return {};
    });

    const res = await request(app).get('/trpc/me').set('Cookie', 'auth_access=valid-token-123');

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: true,
      userId: 'user-123',
      name: 'Test User',
      username: 'testuser',
      role: 'admin',
      accountId: 'acc-456',
    });
  });

  it('returns 401 when no access token provided', async () => {
    const res = await request(app).get('/trpc/me');

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('No access token');
  });

  it('returns 401 when access token is invalid', async () => {
    mockVerify.mockRejectedValue(new Error('Token expired'));

    const res = await request(app).get('/trpc/me').set('Cookie', 'auth_access=expired-token');

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('Invalid or expired token');
  });

  it('returns 401 when access token is malformed', async () => {
    mockVerify.mockRejectedValue(new Error('Invalid token format'));

    const res = await request(app).get('/trpc/me').set('Cookie', 'auth_access=malformed');

    expect(res.status).toBe(401);
  });

  it('creates user in DynamoDB if not found', async () => {
    mockVerify.mockResolvedValue({
      sub: 'new-user-789',
      'cognito:username': 'newuser',
      email: 'new@example.com',
    });

    // First call: user not found
    // Second call: verify user was created
    docSendSpy
      .mockResolvedValueOnce({ Item: undefined })
      .mockImplementation(async (command: any) => {
        if (isCmd(command, PutCommand)) {
          const item = (command as any).input.Item;
          expect(item).toMatchObject({
            PK: 'USER#new-user-789',
            SK: 'METADATA',
            sub: 'new-user-789',
            username: expect.any(String),
          });
          return {};
        }
        return {};
      });

    const res = await request(app).get('/trpc/me').set('Cookie', 'auth_access=new-user-token');

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: true,
      userId: 'new-user-789',
      username: expect.any(String),
    });

    // Verify PutCommand was called to create user
    expect(docSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            PK: 'USER#new-user-789',
          }),
        }),
      }),
    );
  });

  it('handles DynamoDB lookup errors gracefully', async () => {
    mockVerify.mockResolvedValue({
      sub: 'user-123',
      'cognito:username': 'testuser',
      email: 'test@example.com',
    });

    docSendSpy.mockRejectedValue(new Error('DynamoDB service error'));

    const res = await request(app).get('/trpc/me').set('Cookie', 'auth_access=valid-token');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).toContain('Failed to fetch user');
  });

  it('handles missing accountId field gracefully', async () => {
    mockVerify.mockResolvedValue({
      sub: 'user-456',
      'cognito:username': 'olduser',
      email: 'old@example.com',
    });

    docSendSpy.mockResolvedValue({
      Item: {
        PK: 'USER#user-456',
        SK: 'METADATA',
        sub: 'user-456',
        name: 'Old User',
        username: 'olduser',
        role: 'viewer',
        // accountId missing (legacy user)
      },
    });

    const res = await request(app).get('/trpc/me').set('Cookie', 'auth_access=valid-token');

    expect(res.status).toBe(200);
    const data = res.body?.result?.data;
    expect(data).toMatchObject({
      authenticated: true,
      userId: 'user-456',
    });
    expect(data.accountId).toBeUndefined();
  });

  it('parses cookie from lowercase "cookie" header', async () => {
    mockVerify.mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
    });

    docSendSpy.mockResolvedValue({
      Item: {
        sub: 'user-123',
        username: 'testuser',
        role: 'admin',
      },
    });

    const res = await request(app).get('/trpc/me').set('cookie', 'auth_access=lowercase-token');

    expect(res.status).toBe(200);
  });

  it('handles concurrent requests with same token', async () => {
    mockVerify.mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
    });

    docSendSpy.mockResolvedValue({
      Item: {
        sub: 'user-123',
        username: 'testuser',
      },
    });

    // Make multiple concurrent requests
    const requests = Array.from({ length: 5 }, () =>
      request(app).get('/trpc/me').set('Cookie', 'auth_access=valid-token'),
    );

    const results = await Promise.all(requests);

    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.userId).toBe('user-123');
    });
  });
});
