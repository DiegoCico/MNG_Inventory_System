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
    permissions: [
      'team.create',
      'team.view',
      'team.add_member',
      'team.remove_member',
      'team.delete',
    ],
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
  s3SendSpy.mockResolvedValue({ Contents: [] });
});

const validAuthCookie = 'auth_access=valid-token';

const mockTeam = {
  PK: 'TEAM#team123',
  SK: 'METADATA',
  Type: 'Team',
  teamId: 'team123',
  name: 'Alpha Team',
  description: 'Building A',
  uic: 'W12345',
  fe: 'FE001',
  ownerId: 'test-user-id',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  GSI_NAME: 'alpha team',
};

const mockMember = {
  PK: 'TEAM#team123',
  SK: 'MEMBER#test-user-id',
  Type: 'TeamMember',
  teamId: 'team123',
  userId: 'test-user-id',
  role: 'Owner',
  joinedAt: '2024-01-01T00:00:00.000Z',
  GSI1PK: 'USER#test-user-id',
  GSI1SK: 'TEAM#team123',
};

const mockUser = {
  PK: 'USER#user456',
  SK: 'METADATA',
  sub: 'user456',
  username: 'johndoe',
  name: 'John Doe',
  role: 'Member',
};

describe('Teamspace Router', () => {
  describe('createTeamspace', () => {
    it('creates teamspace successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] }; // No duplicate
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createTeamspace')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'New Team',
          description: 'Building C',
          uic: 'W99999',
          fe: 'FE002',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        teamId: expect.any(String),
        name: 'New Team',
      });
    });

    it('rejects duplicate team name', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [mockTeam] });

      const res = await request(app)
        .post('/trpc/createTeamspace')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'Alpha Team',
          description: 'Building A',
          uic: 'W12345',
          fe: 'FE001',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'A team with this name already exists.',
      });
    });

    it('validates name minimum length', async () => {
      const res = await request(app)
        .post('/trpc/createTeamspace')
        .set('Cookie', validAuthCookie)
        .send({
          name: 'A',
          description: 'Location',
          uic: 'UIC',
          fe: 'FE',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/createTeamspace')
        .send({
          name: 'Test Team',
          description: 'Location',
          uic: 'UIC',
          fe: 'FE',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('getTeamspace', () => {
    it('returns teams with status percentages', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          const input = command.input as { IndexName?: string; KeyConditionExpression?: string };
          
          if (input.IndexName === 'GSI_UserTeams') {
            return { Items: [mockMember] };
          }
          // Items query for status calculation
          return {
            Items: [
              { status: 'To Review' },
              { status: 'Completed' },
              { status: 'Completed' },
              { status: 'Shortages' },
            ],
          };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockTeam };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTeamspace')
        .query({ input: JSON.stringify({ userId: 'test-user-id' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
      expect(res.body?.result?.data?.teams[0]).toMatchObject({
        teamId: 'team123',
        percent: 50, // 2 completed out of 4
        totals: {
          toReview: 1,
          completed: 2,
          shortages: 1,
          damaged: 0,
        },
      });
    });

    it('returns empty array when user has no teams', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [] });

      const res = await request(app)
        .get('/trpc/getTeamspace')
        .query({ input: JSON.stringify({ userId: 'test-user-id' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        teams: [],
      });
    });

    it('filters out null teams when metadata not found', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          const input = command.input as { IndexName?: string };
          if (input.IndexName === 'GSI_UserTeams') {
            return { Items: [mockMember] };
          }
          return { Items: [] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null }; // Team metadata not found
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTeamspace')
        .query({ input: JSON.stringify({ userId: 'test-user-id' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.teams).toEqual([]);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/trpc/getTeamspace')
        .query({ input: JSON.stringify({ userId: 'test-user-id' }) });

      expect(res.status).toBe(401);
    });
  });

  describe('getTeamById', () => {
    it('returns team when user is member', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          const key = command.input.Key as { SK: string };
          if (key.SK.startsWith('MEMBER#')) {
            return { Item: mockMember };
          }
          return { Item: mockTeam };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTeamById')
        .query({
          input: JSON.stringify({
            teamId: 'team123',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        team: expect.objectContaining({ teamId: 'team123' }),
      });
    });

    it('returns error when user is not a member', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .get('/trpc/getTeamById')
        .query({
          input: JSON.stringify({
            teamId: 'team123',
            userId: 'unauthorized-user',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'Not authorized to view this team.',
      });
    });

    it('returns error when team not found', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          const key = command.input.Key as { SK: string };
          if (key.SK.startsWith('MEMBER#')) {
            return { Item: mockMember };
          }
          return { Item: null }; // Team not found
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTeamById')
        .query({
          input: JSON.stringify({
            teamId: 'nonexistent',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'Team not found.',
      });
    });
  });

  describe('addUserTeamspace', () => {
    it('adds user to team by username', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockUser] };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          const item = command.input.Item as Record<string, unknown>;
          expect(item.userId).toBe('user456'); // Uses sub from user lookup
          expect(item.role).toBe('Member');
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/addUserTeamspace')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          memberUsername: 'johndoe',
          inviteWorkspaceId: 'team123',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        added: 'johndoe',
      });
    });

    it('returns error when user not found by username', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [] });

      const res = await request(app)
        .post('/trpc/addUserTeamspace')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          memberUsername: 'nonexistent',
          inviteWorkspaceId: 'team123',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'User not found by username.',
      });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/addUserTeamspace')
        .send({
          userId: 'test-user-id',
          memberUsername: 'johndoe',
          inviteWorkspaceId: 'team123',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('removeUserTeamspace', () => {
    it('removes user from team by username', async () => {
      let deleteKey: Record<string, unknown> | null = null;

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockUser] };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          deleteKey = command.input.Key as Record<string, unknown>;
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/removeUserTeamspace')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          memberUsername: 'johndoe',
          inviteWorkspaceId: 'team123',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        removed: 'johndoe',
      });
      expect(deleteKey).toMatchObject({
        PK: 'TEAM#team123',
        SK: 'MEMBER#user456',
      });
    });

    it('returns error when user not found by username', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [] });

      const res = await request(app)
        .post('/trpc/removeUserTeamspace')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'test-user-id',
          memberUsername: 'nonexistent',
          inviteWorkspaceId: 'team123',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'User not found by username.',
      });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/removeUserTeamspace')
        .send({
          userId: 'test-user-id',
          memberUsername: 'johndoe',
          inviteWorkspaceId: 'team123',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('deleteTeamspace', () => {
    it('deletes team and all associated data', async () => {
      const deletedKeys: Array<Record<string, unknown>> = [];

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return {
            Items: [
              { PK: 'TEAM#team123', SK: 'METADATA' },
              { PK: 'TEAM#team123', SK: 'MEMBER#user1' },
              { PK: 'TEAM#team123', SK: 'ITEM#item1' },
            ],
          };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          deletedKeys.push(command.input.Key as Record<string, unknown>);
          return {};
        }
        return {};
      });

      s3SendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'ListObjectsV2Command')) {
          return {
            Contents: [
              { Key: 'items/team123/img1.png' },
              { Key: 'items/team123/img2.png' },
            ],
          };
        }
        if (isCommandNamed(command, 'DeleteObjectsCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/deleteTeamspace')
        .set('Cookie', validAuthCookie)
        .send({
          inviteWorkspaceId: 'team123',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        deleted: 'team123',
      });
      expect(deletedKeys).toHaveLength(3);
      expect(s3SendSpy).toHaveBeenCalledTimes(2); // List + Delete
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/deleteTeamspace')
        .send({
          inviteWorkspaceId: 'team123',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('getAllUsers', () => {
    it('returns all users with their teams', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'ScanCommand')) {
          return { Items: [mockUser] };
        }
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [{ teamId: 'team123', role: 'Member' }] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Alpha Team', GSI_NAME: 'alpha team' } };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getAllUsers')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
      expect(res.body?.result?.data?.users[0]).toMatchObject({
        userId: 'user456',
        username: 'johndoe',
        teams: expect.arrayContaining([
          expect.objectContaining({ teamId: 'team123' }),
        ]),
      });
    });

    it('returns empty array when no users exist', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [] });

      const res = await request(app)
        .get('/trpc/getAllUsers')
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        users: [],
      });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/trpc/getAllUsers');

      expect(res.status).toBe(401);
    });
  });

  describe('getTeamMembers', () => {
    it('returns enriched member data with roles', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return {
            Items: [
              mockTeam, // METADATA
              { ...mockMember, userId: 'user456' }, // MEMBER
            ],
          };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          const key = command.input.Key as { PK: string };
          if (key.PK.startsWith('USER#')) {
            return {
              Item: {
                username: 'johndoe',
                name: 'John Doe',
                role: 'Member',
              },
            };
          }
          if (key.PK.startsWith('ROLE#')) {
            return {
              Item: {
                permissions: ['item.view', 'reports.view'],
              },
            };
          }
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTeamMembers')
        .query({ input: JSON.stringify({ teamId: 'team123' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
      expect(res.body?.result?.data?.members[0]).toMatchObject({
        userId: 'user456',
        username: 'johndoe',
        roleName: 'Member',
        roleId: 'MEMBER',
        permissions: ['item.view', 'reports.view'],
      });
    });

    it('returns empty members when team has no members', async () => {
      dynamoSendSpy.mockResolvedValue({
        Items: [mockTeam], // Only METADATA, no MEMBER records
      });

      const res = await request(app)
        .get('/trpc/getTeamMembers')
        .query({ input: JSON.stringify({ teamId: 'team123' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.members).toEqual([]);
    });

    it('handles missing user metadata gracefully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockMember] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null }; // User not found
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getTeamMembers')
        .query({ input: JSON.stringify({ teamId: 'team123' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.members[0]).toMatchObject({
        roleName: 'No Role',
        permissions: [],
      });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/trpc/getTeamMembers')
        .query({ input: JSON.stringify({ teamId: 'team123' }) });

      expect(res.status).toBe(401);
    });
  });
});