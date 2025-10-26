import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

jest.mock('../../src/aws', () => {
  return { doc: { send: jest.fn() } };
});

jest.mock('../../src/helpers/workspaceHelpers', () => {
  const actual = jest.requireActual('../../src/helpers/workspaceHelpers');
  return {
    ...actual,
    getWorkspace: jest.fn(),
    getUserRoleInWorkspace: jest.fn(),
    checkPermission: jest.fn(),
  };
});

import { workspaceRouter } from '../../src/routers/workspace';
import { doc } from '../../src/aws';
import {
  checkPermission,
  getUserRoleInWorkspace as getUserRoleInWs,
  getWorkspace as getWs,
} from '../../src/helpers/workspaceHelpers';

const mockedDocSend = doc.send as jest.Mock;
const mockedCheckPermission = checkPermission as jest.Mock;
const mockedGetUserRoleInWs = getUserRoleInWs as jest.Mock;
const mockedGetWs = getWs as jest.Mock;

describe('workspaceRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createCaller = () => workspaceRouter.createCaller({} as any);

  describe('createWorkspace', () => {
    it('creates workspace and returns metadata', async () => {
      mockedDocSend
        .mockImplementationOnce((cmd) => {
          expect(cmd).toBeInstanceOf(QueryCommand);
          return Promise.resolve({ Items: [{ SK: 'ROLE#ownerRole123' }] });
        })
        .mockImplementationOnce((cmd) => {
          expect(cmd).toBeInstanceOf(BatchWriteCommand);
          return Promise.resolve({});
        });

      const caller = createCaller();
      const res = await caller.createWorkspace({
        name: 'My Team',
        description: 'A team',
        userId: 'user-1',
      });

      expect(res.success).toBe(true);
      expect(res.workspace.ownerId).toBe('user-1');
      expect(res.workspace.roleId).toBe('ownerRole123');
      expect(res.workspace.workspaceId).toBeDefined();
      expect(res.message).toBe('Workspace created successfully');
      expect(mockedDocSend).toHaveBeenCalledTimes(2);
    });

    it('fails when owner role not found', async () => {
      mockedDocSend.mockResolvedValueOnce({ Items: [] });
      const caller = createCaller();
      await expect(caller.createWorkspace({ name: 'Te', userId: 'user-1' })).rejects.toBeTruthy();
    });
  });

  describe('addMember', () => {
    it('adds a member when permitted and not existing', async () => {
      mockedCheckPermission.mockResolvedValue({ allowed: true });
      mockedGetUserRoleInWs.mockResolvedValueOnce(null);
      mockedDocSend.mockImplementationOnce((cmd) => {
        expect(cmd).toBeInstanceOf(BatchWriteCommand);
        return Promise.resolve({});
      });

      const caller = createCaller();
      const res = await caller.addMember({
        workspaceId: 'ws-1',
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
          workspaceId: 'ws-1',
          userId: 'user-x',
          newMemberId: 'user-y',
          roleId: 'role-2',
        }),
      ).rejects.toBeTruthy();
    });

    it('fails when member already exists', async () => {
      mockedCheckPermission.mockResolvedValue({ allowed: true });
      mockedGetUserRoleInWs.mockResolvedValueOnce('existing-role');
      const caller = createCaller();
      await expect(
        caller.addMember({
          workspaceId: 'ws-1',
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
      mockedGetWs.mockResolvedValue({
        PK: 'WORKSPACE#ws-1',
        SK: 'METADATA',
        workspaceId: 'ws-1',
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
        workspaceId: 'ws-1',
        userId: 'admin-1',
        memberId: 'user-2',
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe('Member removed successfully');
      expect(mockedDocSend).toHaveBeenCalledTimes(1);
    });

    it('fails when trying to remove owner', async () => {
      mockedCheckPermission.mockResolvedValue({ allowed: true });
      mockedGetWs.mockResolvedValue({
        PK: 'WORKSPACE#ws-1',
        SK: 'METADATA',
        workspaceId: 'ws-1',
        name: 'Team',
        ownerId: 'user-2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const caller = createCaller();
      await expect(
        caller.removeMember({
          workspaceId: 'ws-1',
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
          workspaceId: 'ws-1',
          userId: 'user-x',
          memberId: 'user-y',
        }),
      ).rejects.toBeTruthy();
    });
  });

  describe('getWorkspace', () => {
    it('returns workspace with members when user is a member', async () => {
      mockedGetUserRoleInWs.mockResolvedValue('role-1');
      mockedGetWs.mockResolvedValue({
        PK: 'WORKSPACE#ws-1',
        SK: 'METADATA',
        workspaceId: 'ws-1',
        name: 'Team',
        ownerId: 'owner-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        description: 'Desc',
      });
      mockedDocSend.mockImplementationOnce((cmd) => {
        expect(cmd).toBeInstanceOf(QueryCommand);
        return Promise.resolve({
          Items: [
            {
              PK: 'WORKSPACE#ws-1',
              SK: 'MEMBER#user-1',
              workspaceId: 'ws-1',
              userId: 'user-1',
              roleId: 'role-1',
              addedAt: new Date().toISOString(),
            },
            {
              PK: 'WORKSPACE#ws-1',
              SK: 'MEMBER#user-2',
              workspaceId: 'ws-1',
              userId: 'user-2',
              roleId: 'role-2',
              addedAt: new Date().toISOString(),
            },
          ],
        });
      });

      const caller = createCaller();
      const res = await caller.getWorkspace({ workspaceId: 'ws-1', userId: 'user-1' });

      expect(res.success).toBe(true);
      expect(res.workspace.workspaceId).toBe('ws-1');
      expect(res.workspace.members).toHaveLength(2);
      expect(res.workspace.members[0]).toMatchObject({ userId: 'user-1', roleId: 'role-1' });
      expect(res.workspace.members[1]).toMatchObject({ userId: 'user-2', roleId: 'role-2' });
    });

    it('fails when requesting user is not a member', async () => {
      mockedGetUserRoleInWs.mockResolvedValue(null);
      const caller = createCaller();
      await expect(
        caller.getWorkspace({ workspaceId: 'ws-1', userId: 'stranger' }),
      ).rejects.toBeTruthy();
    });
  });
});
