import request from 'supertest';
import app from '../src/server';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

// Mock JWT verifier
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

// Mock permissions
jest.mock('../src/helpers/teamspaceHelpers', () => ({
  getUserPermissions: jest.fn(async () => ({
    roleName: 'OWNER',
    permissions: ['user.assign_roles', 'user.delete'],
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
let s3SendSpy: jest.SpyInstance;

beforeAll(() => {
  dynamoSendSpy = jest.spyOn(DynamoDBDocumentClient.prototype, 'send');
  s3SendSpy = jest.spyOn(S3Client.prototype, 'send');
});

afterAll(() => {
  dynamoSendSpy.mockRestore();
  s3SendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  s3SendSpy.mockResolvedValue({});
});

const validAuthCookie = 'auth_access=valid-token';

const mockUser = {
  PK: 'USER#user123',
  SK: 'METADATA',
  sub: 'user123',
  username: 'johndoe',
  name: 'John Doe',
  role: 'Member',
};

const mockRole = {
  PK: 'ROLE#ADMIN',
  SK: 'METADATA',
  roleId: 'ADMIN',
  name: 'Admin',
  permissions: ['item.view', 'item.create'],
};

describe('Users Router', () => {
  describe('listUsersWithRoles', () => {
    it('returns all users with roles', async () => {
      dynamoSendSpy.mockResolvedValue({
        Items: [mockUser, { ...mockUser, sub: 'user456', username: 'janedoe' }],
      });

      const res = await request(app)
        .get('/trpc/listUsersWithRoles')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.users).toHaveLength(2);
      expect(res.body?.result?.data?.users[0]).toMatchObject({
        userId: 'user123',
        username: 'johndoe',
        name: 'John Doe',
        roleName: 'Member',
      });
    });

    it('returns empty array when no users', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [] });

      const res = await request(app)
        .get('/trpc/listUsersWithRoles')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.users).toEqual([]);
    });

    it('handles missing fields with defaults', async () => {
      dynamoSendSpy.mockResolvedValue({
        Items: [{ PK: 'USER#user123', SK: 'METADATA', sub: 'user123' }],
      });

      const res = await request(app)
        .get('/trpc/listUsersWithRoles')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.users[0]).toMatchObject({
        username: 'Unknown',
        name: 'Unknown User',
        roleName: 'No Role',
      });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/trpc/listUsersWithRoles');
      expect(res.status).toBe(401);
    });
  });

  describe('assignRole', () => {
    it('assigns role to user', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockRole };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          expect(values[':roleName']).toBe('Admin');
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/assignRole')
        .set('Cookie', validAuthCookie)
        .send({ userId: 'user123', roleName: 'Admin' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        roleName: 'Admin',
      });
    });

    it('throws error when role not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .post('/trpc/assignRole')
        .set('Cookie', validAuthCookie)
        .send({ userId: 'user123', roleName: 'NonexistentRole' });

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).toContain('Role not found');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/assignRole')
        .send({ userId: 'user123', roleName: 'Admin' });
      expect(res.status).toBe(401);
    });
  });

  describe('getUserRole', () => {
    it('returns user role', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: mockUser });

      const res = await request(app)
        .get('/trpc/getUserRole')
        .query({ input: JSON.stringify({ userId: 'user123' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        userId: 'user123',
        roleName: 'Member',
      });
    });

    it('returns "No Role" when role field missing', async () => {
      dynamoSendSpy.mockResolvedValue({
        Item: { PK: 'USER#user123', SK: 'METADATA' },
      });

      const res = await request(app)
        .get('/trpc/getUserRole')
        .query({ input: JSON.stringify({ userId: 'user123' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.roleName).toBe('No Role');
    });

    it('throws error when user not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .get('/trpc/getUserRole')
        .query({ input: JSON.stringify({ userId: 'nonexistent' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).toContain('User not found');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/trpc/getUserRole')
        .query({ input: JSON.stringify({ userId: 'user123' }) });
      expect(res.status).toBe(401);
    });
  });

  describe('deleteUser', () => {
    it('deletes user, profile images, and team memberships', async () => {
      const deletedKeys: Array<Record<string, unknown>> = [];

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return {
            Items: [
              { PK: 'USER#user123', SK: 'TEAM#team1' },
              { PK: 'USER#user123', SK: 'TEAM#team2' },
            ],
          };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          deletedKeys.push(command.input.Key as Record<string, unknown>);
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/deleteUser')
        .set('Cookie', validAuthCookie)
        .send({ userId: 'user123' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({ success: true });

      // User metadata + 2 team memberships deleted
      expect(deletedKeys).toHaveLength(3);
      expect(s3SendSpy).toHaveBeenCalled(); // Profile image cleanup attempted
    });

    it('continues when S3 delete fails', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          return {};
        }
        return {};
      });

      s3SendSpy.mockRejectedValue(new Error('S3 error'));

      const res = await request(app)
        .post('/trpc/deleteUser')
        .set('Cookie', validAuthCookie)
        .send({ userId: 'user123' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/deleteUser')
        .send({ userId: 'user123' });
      expect(res.status).toBe(401);
    });
  });
});