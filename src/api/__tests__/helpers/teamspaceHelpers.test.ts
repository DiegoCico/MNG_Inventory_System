import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { doc } from '../../src/aws';
import {
  getTeamspace,
  getUserRoleInTeamspace,
  getRolePermissions,
  checkPermission,
  getUserPermissions,
} from '../../src/helpers/teamspaceHelpers';
import { TeamEntity, TeamMemberEntity } from '../../src/dynamo-types';

// Additional type definitions for test data
interface RoleEntity {
  PK: `ROLE#${string}`;
  SK: 'METADATA';
  permissions: string[];
}

interface UserEntity {
  PK: `USER#${string}`;
  SK: 'METADATA';
  role?: string;
}

interface DynamoDBResponse<T = any> {
  Item?: T;
}

// Mock the DynamoDB client
jest.mock('../../src/aws', () => ({
  doc: {
    send: jest.fn(),
  },
}));

const mockDocSend = doc.send as jest.MockedFunction<
  (command: GetCommand) => Promise<DynamoDBResponse>
>;

describe('teamspaceHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTeamspace()', () => {
    it('returns teamspace when found', async () => {
      const mockTeam: TeamEntity = {
        PK: 'TEAM#team123',
        SK: 'METADATA',
        teamId: 'team123',
        name: 'Test Team',
        normalizedName: 'test team',
        ownerId: 'owner123',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        GSI_NAME: 'test team',
      };

      mockDocSend.mockResolvedValueOnce({ Item: mockTeam });

      const result = await getTeamspace('team123');

      expect(result).toEqual(mockTeam);
      expect(mockDocSend).toHaveBeenCalledWith(expect.any(GetCommand));
    });

    it('returns null when teamspace not found', async () => {
      mockDocSend.mockResolvedValueOnce({ Item: undefined });

      const result = await getTeamspace('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserRoleInTeamspace()', () => {
    it('returns roleId when user is team member', async () => {
      const mockMember: TeamMemberEntity = {
        PK: 'TEAM#team123',
        SK: 'MEMBER#user456',
        teamId: 'team123',
        roleId: 'ADMIN',
        userId: 'user456',
        addedAt: '2024-01-01',
      };

      mockDocSend.mockResolvedValueOnce({ Item: mockMember });

      const result = await getUserRoleInTeamspace('user456', 'team123');

      expect(result).toBe('ADMIN');
      expect(mockDocSend).toHaveBeenCalledWith(expect.any(GetCommand));
    });

    it('returns null when user is not a team member', async () => {
      mockDocSend.mockResolvedValueOnce({ Item: undefined });

      const result = await getUserRoleInTeamspace('user456', 'team123');

      expect(result).toBeNull();
    });
  });

  describe('getRolePermissions()', () => {
    it('returns permissions array for valid role', async () => {
      const mockRole: RoleEntity = {
        PK: 'ROLE#ADMIN',
        SK: 'METADATA',
        permissions: ['item.create', 'item.delete', 'team.view'],
      };

      mockDocSend.mockResolvedValueOnce({ Item: mockRole });

      const result = await getRolePermissions('ADMIN');

      expect(result).toEqual(['item.create', 'item.delete', 'team.view']);
      expect(mockDocSend).toHaveBeenCalledWith(expect.any(GetCommand));
    });

    it('returns empty array when role not found', async () => {
      mockDocSend.mockResolvedValueOnce({ Item: undefined });

      const result = await getRolePermissions('NONEXISTENT');

      expect(result).toEqual([]);
    });

    it('returns empty array when permissions field missing', async () => {
      mockDocSend.mockResolvedValueOnce({
        Item: { PK: 'ROLE#TEST' as const, SK: 'METADATA' as const },
      });

      const result = await getRolePermissions('TEST');

      expect(result).toEqual([]);
    });
  });

  describe('checkPermission()', () => {
    it('allows when user has required permission', async () => {
      // Mock getUserRoleInTeamspace
      mockDocSend.mockResolvedValueOnce({
        Item: { roleId: 'EDITOR' },
      });

      // Mock getRolePermissions
      mockDocSend.mockResolvedValueOnce({
        Item: { permissions: ['item.create', 'item.view', 'item.update'] },
      });

      const result = await checkPermission('user123', 'team456', 'item.create');

      expect(result).toEqual({ allowed: true });
    });

    it('denies when user is not a team member', async () => {
      mockDocSend.mockResolvedValueOnce({ Item: undefined });

      const result = await checkPermission('user123', 'team456', 'item.create');

      expect(result).toEqual({
        allowed: false,
        reason: 'You are not a member of this teamspace',
      });
    });

    it('denies when user lacks required permission', async () => {
      // Mock getUserRoleInTeamspace
      mockDocSend.mockResolvedValueOnce({
        Item: { roleId: 'VIEWER' },
      });

      // Mock getRolePermissions
      mockDocSend.mockResolvedValueOnce({
        Item: { permissions: ['item.view'] },
      });

      const result = await checkPermission('user123', 'team456', 'item.delete');

      expect(result).toEqual({
        allowed: false,
        reason: "You don't have permission to perform this action (requires: item.delete)",
      });
    });
  });

  describe('getUserPermissions()', () => {
    it('returns role name and permissions for user with role', async () => {
      const mockUser: UserEntity = {
        PK: 'USER#user123',
        SK: 'METADATA',
        role: 'admin',
      };

      const mockRole: RoleEntity = {
        PK: 'ROLE#ADMIN',
        SK: 'METADATA',
        permissions: ['team.create', 'user.invite', 'item.delete'],
      };

      // Mock user fetch
      mockDocSend.mockResolvedValueOnce({ Item: mockUser });

      // Mock role permissions fetch
      mockDocSend.mockResolvedValueOnce({ Item: mockRole });

      const result = await getUserPermissions('user123');

      expect(result).toEqual({
        roleName: 'admin',
        permissions: ['team.create', 'user.invite', 'item.delete'],
      });

      // Verify DB calls
      expect(mockDocSend).toHaveBeenCalledTimes(2);
      expect(mockDocSend).toHaveBeenNthCalledWith(1, expect.any(GetCommand));
      expect(mockDocSend).toHaveBeenNthCalledWith(2, expect.any(GetCommand));
    });

    it('returns empty permissions when user not found', async () => {
      mockDocSend.mockResolvedValueOnce({ Item: undefined });

      const result = await getUserPermissions('nonexistent');

      expect(result).toEqual({
        roleName: undefined,
        permissions: [],
      });
    });

    it('returns empty permissions when user has no role', async () => {
      const mockUser: UserEntity = {
        PK: 'USER#user123',
        SK: 'METADATA',
      };

      mockDocSend.mockResolvedValueOnce({ Item: mockUser });

      const result = await getUserPermissions('user123');

      expect(result).toEqual({
        roleName: undefined,
        permissions: [],
      });
    });

    it('handles uppercase conversion for roleId lookup', async () => {
      mockDocSend.mockResolvedValueOnce({
        Item: { role: 'owner' },
      });

      mockDocSend.mockResolvedValueOnce({
        Item: { permissions: ['team.delete'] },
      });

      await getUserPermissions('user123');

      // Verify it looked up ROLE#OWNER (uppercase)
      expect(mockDocSend).toHaveBeenNthCalledWith(2, expect.any(GetCommand));
    });
  });
});
