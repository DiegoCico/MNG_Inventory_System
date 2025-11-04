import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

jest.mock('../../src/aws', () => {
  return { doc: { send: jest.fn() } };
});

jest.mock('../../src/helpers/teamspaceHelpers', () => {
  const actual = jest.requireActual('../../src/helpers/teamspaceHelpers');
  return {
    ...actual,
    getTeamspace: jest.fn(),
    getUserRoleInTeamspace: jest.fn(),
    checkPermission: jest.fn(),
  };
});

import { teamspaceRouter } from '../../src/routers/teamspace';
import { doc } from '../../src/aws';
import {
  checkPermission,
  getUserRoleInTeamspace as getUserRoleInTs,
  getTeamspace as getTs,
} from '../../src/helpers/teamspaceHelpers';

const mockedDocSend = doc.send as jest.Mock;
const mockedCheckPermission = checkPermission as jest.Mock;
const mockedGetUserRoleInTs = getUserRoleInTs as jest.Mock;
const mockedGetTs = getTs as jest.Mock;

describe('teamspaceRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createCaller = () => teamspaceRouter.createCaller({} as any);

  describe('createTeamspace', () => {
    it('creates teamspace and returns metadata', async () => {
      mockedDocSend
        .mockImplementationOnce((cmd) => {
          expect(cmd).toBeInstanceOf(QueryCommand);
          return Promise.resolve({ Items: [] });
        })
        .mockImplementationOnce((cmd) => {
          expect(cmd).toBeInstanceOf(QueryCommand);
          return Promise.resolve({ Items: [{ SK: 'ROLE#ownerRole123' }] });
        })
        .mockImplementationOnce((cmd) => {
          expect(cmd).toBeInstanceOf(BatchWriteCommand);
          return Promise.resolve({});
        });

      const caller = createCaller();
      const res = await caller.createTeamspace({
        name: 'My Team',
        description: 'A team',
        userId: 'user-1',
      });

      expect(res.success).toBe(true);
      expect(res.team.ownerId).toBe('user-1');
      expect(res.team.roleId).toBe('ownerRole123');
      expect(res.team.teamId).toBeDefined();
      expect(res.message).toBe('Teamspace created successfully');
      expect(mockedDocSend).toHaveBeenCalledTimes(3);
    });

    it('fails when owner role not found', async () => {
      mockedDocSend.mockResolvedValueOnce({ Items: [] });
      const caller = createCaller();
      await expect(
        caller.createTeamspace({ name: 'Te', userId: 'user-1' }),
      ).rejects.toBeTruthy();
    });
  });

  describe('addMember', () => {
    it('adds a member when permitted and not existing', async () => {
      mockedCheckPermission.mockResolvedValue({ allowed: true });
      mockedGetUserRoleInTs.mockResolvedValueOnce(null);
      mockedDocSend.mockImplementationOnce((cmd) => {
        expect(cmd).toBeInstanceOf(BatchWriteCommand);
        return Promise.resolve({});
      });

      const caller = createCaller();
      const res = await caller.addMember({
        teamId: 'team-1',
        userId: 'admin-1',
        newMemberId: 'user-2',
        roleId: 'role-2',
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe('Member added successfully');
      expect(res.member.userId).toBe('user-2');
      expect(res.member.roleId).toBe('role-2');
      expect(typeof res.member.addedAt).toBe('string');
      expect(mockedDocSend).toHaveBeenCalledTimes(1);
    });

    it('fails when permission denied', async () => {
      mockedCheckPermission.mockResolvedValue({ allowed: false, reason: 'denied' });
      const caller = createCaller();
      await expect(
        caller.addMember({
          teamId: 'team-1',
          userId: 'user-x',
          newMemberId: 'user-y',
          roleId: 'role-2',
        }),
      ).rejects.toBeTruthy();
    });

    it('fails when member already exists', async () => {
      mockedCheckPermission.mockResolvedValue({ allowed: true });
      mockedGetUserRoleInTs.mockResolvedValueOnce('existing-role');
      const caller = createCaller();
      await expect(
        caller.addMember({
          teamId: 'team-1',
          userId: 'admin-1',
          newMemberId: 'user-2',
          roleId: 'role-2',
        }),
      ).rejects.toBeTruthy();
    });
  });

  describe('removeMember', () => {
    it('removes a member when permitted and not owner', async () => {
      mockedCheckPermission.mockResolvedValue({ allowed: true });
      mockedGetTs.mockResolvedValue({
        PK: 'TEAM#team-1',
        SK: 'METADATA',
        teamId: 'team-1',
        name: 'Team',
        ownerId: 'owner-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      mockedDocSend.mockImplementationOnce((cmd) => {
        expect(cmd).toBeInstanceOf(BatchWriteCommand);
        return Promise.resolve({});
      });

      const caller = createCaller();
      const res = await caller.removeMember({
        teamId: 'team-1',
        userId: 'admin-1',
        memberId: 'user-2',
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe('Member removed successfully');
      expect(mockedDocSend).toHaveBeenCalledTimes(1);
    });

    it('fails when trying to remove owner', async () => {
      mockedCheckPermission.mockResolvedValue({ allowed: true });
      mockedGetTs.mockResolvedValue({
        PK: 'TEAM#team-1',
        SK: 'METADATA',
        teamId: 'team-1',
        name: 'Team',
        ownerId: 'user-2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const caller = createCaller();
      await expect(
        caller.removeMember({
          teamId: 'team-1',
          userId: 'admin-1',
          memberId: 'user-2',
        }),
      ).rejects.toBeTruthy();
    });

    it('fails when permission denied', async () => {
      mockedCheckPermission.mockResolvedValue({ allowed: false, reason: 'denied' });
      const caller = createCaller();
      await expect(
        caller.removeMember({
          teamId: 'team-1',
          userId: 'user-x',
          memberId: 'user-y',
        }),
      ).rejects.toBeTruthy();
    });
  });

  describe('getTeamspace', () => {
    it('returns teamspace with members when user is a member', async () => {
      mockedGetUserRoleInTs.mockResolvedValue('role-1');
      mockedGetTs.mockResolvedValue({
        PK: 'TEAM#team-1',
        SK: 'METADATA',
        teamId: 'team-1',
        name: 'Team',
        ownerId: 'owner-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        description: 'Desc',
      });

      mockedDocSend
        .mockImplementationOnce((cmd) => {
          expect(cmd).toBeInstanceOf(QueryCommand);
          return Promise.resolve({
            Items: [
              {
                PK: 'TEAM#team-1',
                SK: 'MEMBER#user-1',
                teamId: 'team-1',
                userId: 'user-1',
                roleId: 'role-1',
                addedAt: new Date().toISOString(),
              },
              {
                PK: 'TEAM#team-1',
                SK: 'MEMBER#user-2',
                teamId: 'team-1',
                userId: 'user-2',
                roleId: 'role-2',
                addedAt: new Date().toISOString(),
              },
            ],
          });
        });

      const caller = createCaller();
      const res = await caller.getTeamspace({ teamId: 'team-1', userId: 'user-1' });

      expect(res.success).toBe(true);
      expect(res.team.teamId).toBe('team-1');
      expect(res.team.members).toHaveLength(2);
      expect(res.team.members[0]).toMatchObject({ userId: 'user-1', roleId: 'role-1' });
      expect(res.team.members[1]).toMatchObject({ userId: 'user-2', roleId: 'role-2' });
    });

    it('fails when requesting user is not a member', async () => {
      mockedGetUserRoleInTs.mockResolvedValue(null);
      const caller = createCaller();
      await expect(
        caller.getTeamspace({ teamId: 'team-1', userId: 'stranger' }),
      ).rejects.toBeTruthy();
    });
  });
});
