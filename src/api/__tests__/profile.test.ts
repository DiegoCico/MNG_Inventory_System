import request from 'supertest';
import app from '../src/server';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock JWT verifier for protected routes
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(async () => ({
        sub: 'test-user-id',
        'cognito:username': 'testuser',
        email: 'test@example.com',
      })),
    })),
  },
}));

// Mock permissions (profile routes use protectedProcedure, not permissionedProcedure)
jest.mock('../src/helpers/teamspaceHelpers', () => ({
  getUserPermissions: jest.fn(async () => ({
    roleName: 'USER',
    permissions: [],
  })),
}));

interface MockableCommand {
  constructor: { name: string };
  input: Record<string, unknown>;
}

function isCommandNamed(cmd: MockableCommand, name: string): boolean {
  return cmd.constructor.name === name;
}

let dynamoSendSpy: jest.SpyInstance;

beforeAll(() => {
  dynamoSendSpy = jest.spyOn(DynamoDBDocumentClient.prototype, 'send');
});

afterAll(() => {
  dynamoSendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const validAuthCookie = 'auth_access=valid-token';

const mockUser = {
  PK: 'USER#test-user-id',
  SK: 'METADATA',
  sub: 'test-user-id',
  username: 'testuser',
  name: 'Test User',
  role: 'User',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('Profile Router', () => {
  describe('getProfile', () => {
    it('returns existing user profile', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockUser };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          // Team lookup
          return { Items: [{ teamName: 'Alpha Team' }] };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getProfile')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        authenticated: true,
        userId: 'test-user-id',
        username: 'testuser',
        name: 'Test User',
        role: 'User',
        team: 'Alpha Team',
      });
    });

    it('creates new user if not found', async () => {
      let userCreated = false;

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          const input = command.input as { IndexName?: string };
          // Username uniqueness check
          if (input.IndexName === 'GSI_UsersByUsername') {
            return { Items: [] };
          }
          // Team lookup
          return { Items: [] };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          userCreated = true;
          return {};
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getProfile')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(userCreated).toBe(true);
      expect(res.body?.result?.data).toMatchObject({
        authenticated: true,
        userId: 'test-user-id',
        username: expect.stringMatching(/^user-/),
        role: 'User',
        team: 'No Team Assigned',
      });
    });

    it('returns "No Team Assigned" when user has no team', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockUser };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getProfile')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.team).toBe('No Team Assigned');
    });

    it('returns 401 without auth cookie', async () => {
      const res = await request(app).get('/trpc/getProfile');

      expect(res.status).toBe(401);
    });

    it('handles DynamoDB errors gracefully', async () => {
      dynamoSendSpy.mockRejectedValue(new Error('DynamoDB unavailable'));

      const res = await request(app)
        .get('/trpc/getProfile')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).toContain('Failed to fetch profile');
    });
  });

  describe('updateProfile', () => {
    it('updates name successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockUser };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          expect(values[':name']).toBe('New Name');
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateProfile')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          name: 'New Name',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        message: 'Profile updated',
      });
    });

    it('updates username with uniqueness check', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockUser };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] }; // Username available
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          expect(values[':username']).toBe('newusername');
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateProfile')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          username: 'newusername',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
    });

    it('sanitizes username - removes special characters', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockUser };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          // Special chars removed, only alphanumeric, underscore, hyphen allowed
          expect(values[':username']).toBe('test_user-123');
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateProfile')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          username: 'test_user-123!@#$%',
        });

      expect(res.status).toBe(200);
    });

    it('updates role successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockUser };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          expect(values[':role']).toBe('Admin');
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateProfile')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          role: 'Admin',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
    });

    it('updates multiple fields at once', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockUser };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          expect(values[':name']).toBe('Updated Name');
          expect(values[':username']).toBe('updateduser');
          expect(values[':role']).toBe('Manager');
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateProfile')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          name: 'Updated Name',
          username: 'updateduser',
          role: 'Manager',
        });

      expect(res.status).toBe(200);
    });

    it('returns "No changes" when values are same as existing', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockUser };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateProfile')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          name: 'Test User', // Same as existing
          username: 'testuser', // Same as existing
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        message: 'No changes',
      });
    });

    it('returns error when user not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .post('/trpc/updateProfile')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          name: 'New Name',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        message: 'User not found',
      });
    });

    it('returns 403 when trying to update another user', async () => {
      const res = await request(app)
        .post('/trpc/updateProfile')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'different-user-id',
          name: 'Hacked Name',
        });

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toContain('Cannot update another user');
    });

    it('returns 401 without auth cookie', async () => {
      const res = await request(app)
        .post('/trpc/updateProfile')
        .send({
          userId: 'test-user-id',
          name: 'New Name',
        });

      expect(res.status).toBe(401);
    });

    it('handles DynamoDB errors gracefully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockUser };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          throw new Error('DynamoDB unavailable');
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateProfile')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          name: 'New Name',
        });

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).toContain('Failed to update profile');
    });
  });
});