import request from 'supertest';
import app from '../src/server';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

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
    permissions: ['role.add', 'role.modify', 'role.remove', 'role.view'],
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

const mockRole = {
  PK: 'ROLE#CUSTOM',
  SK: 'METADATA',
  roleId: 'CUSTOM',
  name: 'Custom',
  description: 'A custom role',
  permissions: ['item.view', 'item.create'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('Roles Router', () => {
  describe('createRole', () => {
    it('creates new role successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null }; // Role doesn't exist
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createRole')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'Editor',
          description: 'Can edit items',
          permissions: ['item.view', 'item.update'],
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        role: expect.objectContaining({
          roleId: 'EDITOR',
          name: 'Editor',
          permissions: ['item.view', 'item.update'],
        }),
      });
    });

    it('rejects duplicate role name', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: mockRole });

      const res = await request(app)
        .post('/trpc/createRole')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'Custom',
          permissions: ['item.view'],
        });

      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toContain('already exists');
    });

    it('validates name minimum length', async () => {
      const res = await request(app)
        .post('/trpc/createRole')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'A', // Too short
          permissions: ['item.view'],
        });

      expect(res.status).toBe(400);
    });

    it('validates permissions array is not empty', async () => {
      const res = await request(app)
        .post('/trpc/createRole')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'Empty Role',
          permissions: [],
        });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/createRole')
        .send({
          name: 'Test',
          permissions: ['item.view'],
        });

      expect(res.status).toBe(401);
    });
  });

  describe('getAllRoles', () => {
    it('returns all roles', async () => {
      dynamoSendSpy.mockResolvedValue({
        Items: [
          mockRole,
          { ...mockRole, PK: 'ROLE#VIEWER', roleId: 'VIEWER', name: 'Viewer' },
        ],
      });

      const res = await request(app)
        .get('/trpc/getAllRoles')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.roles).toHaveLength(2);
    });

    it('returns empty array when no roles exist', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [] });

      const res = await request(app)
        .get('/trpc/getAllRoles')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.roles).toEqual([]);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/trpc/getAllRoles');

      expect(res.status).toBe(401);
    });
  });

  describe('getRole', () => {
    it('returns role by roleId', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: mockRole });

      const res = await request(app)
        .get('/trpc/getRole')
        .query({ input: JSON.stringify({ roleId: 'CUSTOM' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.role).toMatchObject({
        roleId: 'CUSTOM',
        name: 'Custom',
      });
    });

    it('returns role by name (converts to uppercase)', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: mockRole });

      const res = await request(app)
        .get('/trpc/getRole')
        .query({ input: JSON.stringify({ name: 'custom' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.role).toMatchObject({
        roleId: 'CUSTOM',
      });
    });

    it('returns 404 when role not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .get('/trpc/getRole')
        .query({ input: JSON.stringify({ roleId: 'NONEXISTENT' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toContain('Role not found');
    });

    it('returns 400 when neither roleId nor name provided', async () => {
      const res = await request(app)
        .get('/trpc/getRole')
        .query({ input: JSON.stringify({}) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('Provide roleId or name');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/trpc/getRole')
        .query({ input: JSON.stringify({ roleId: 'CUSTOM' }) });

      expect(res.status).toBe(401);
    });
  });

  describe('updateRole', () => {
    it('updates role successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockRole };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {
            Attributes: {
              ...mockRole,
              description: 'Updated description',
              permissions: ['item.view', 'item.update', 'item.delete'],
            },
          };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateRole')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'Custom',
          description: 'Updated description',
          permissions: ['item.view', 'item.update', 'item.delete'],
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        role: expect.objectContaining({
          description: 'Updated description',
        }),
      });
    });

    it('returns 404 when role not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .post('/trpc/updateRole')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'Nonexistent',
          description: 'Test',
        });

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toContain('Role not found');
    });

    it('prevents modifying default Owner role', async () => {
      const ownerRole = {
        ...mockRole,
        PK: 'ROLE#OWNER',
        roleId: 'OWNER',
        name: 'Owner',
      };
      dynamoSendSpy.mockResolvedValue({ Item: ownerRole });

      const res = await request(app)
        .post('/trpc/updateRole')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'Owner',
          description: 'Hacked',
        });

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toContain('Cannot modify default roles');
    });

    it('prevents modifying default Manager role', async () => {
      const managerRole = {
        ...mockRole,
        PK: 'ROLE#MANAGER',
        roleId: 'MANAGER',
        name: 'Manager',
      };
      dynamoSendSpy.mockResolvedValue({ Item: managerRole });

      const res = await request(app)
        .post('/trpc/updateRole')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'Manager',
          permissions: ['item.delete'],
        });

      expect(res.status).toBe(403);
    });

    it('prevents modifying default Member role', async () => {
      const memberRole = {
        ...mockRole,
        PK: 'ROLE#MEMBER',
        roleId: 'MEMBER',
        name: 'Member',
      };
      dynamoSendSpy.mockResolvedValue({ Item: memberRole });

      const res = await request(app)
        .post('/trpc/updateRole')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'Member',
          description: 'Modified',
        });

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/updateRole')
        .send({
          name: 'Custom',
          description: 'Test',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('deleteRole', () => {
    it('deletes role successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockRole };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/deleteRole')
        .set('Cookie', validAuthCookie)
        .send({ name: 'Custom' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        deleted: true,
      });
    });

    it('returns success with deleted=false when role not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .post('/trpc/deleteRole')
        .set('Cookie', validAuthCookie)
        .send({ name: 'Nonexistent' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        deleted: false,
      });
    });

    it('prevents deleting default Owner role', async () => {
      const ownerRole = {
        ...mockRole,
        PK: 'ROLE#OWNER',
        roleId: 'OWNER',
        name: 'Owner',
      };
      dynamoSendSpy.mockResolvedValue({ Item: ownerRole });

      const res = await request(app)
        .post('/trpc/deleteRole')
        .set('Cookie', validAuthCookie)
        .send({ name: 'Owner' });

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toContain('Cannot delete default roles');
    });

    it('prevents deleting default Manager role', async () => {
      const managerRole = {
        ...mockRole,
        PK: 'ROLE#MANAGER',
        roleId: 'MANAGER',
        name: 'Manager',
      };
      dynamoSendSpy.mockResolvedValue({ Item: managerRole });

      const res = await request(app)
        .post('/trpc/deleteRole')
        .set('Cookie', validAuthCookie)
        .send({ name: 'Manager' });

      expect(res.status).toBe(403);
    });

    it('prevents deleting default Member role', async () => {
      const memberRole = {
        ...mockRole,
        PK: 'ROLE#MEMBER',
        roleId: 'MEMBER',
        name: 'Member',
      };
      dynamoSendSpy.mockResolvedValue({ Item: memberRole });

      const res = await request(app)
        .post('/trpc/deleteRole')
        .set('Cookie', validAuthCookie)
        .send({ name: 'Member' });

      expect(res.status).toBe(403);
    });

    it('handles case-insensitive role names', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          const key = command.input.Key as { PK: string };
          expect(key.PK).toBe('ROLE#CUSTOM'); // Should be uppercase
          return { Item: mockRole };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/deleteRole')
        .set('Cookie', validAuthCookie)
        .send({ name: 'custom' }); // lowercase input

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.deleted).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/deleteRole')
        .send({ name: 'Custom' });

      expect(res.status).toBe(401);
    });
  });
});