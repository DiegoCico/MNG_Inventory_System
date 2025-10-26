import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import { QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { doc } from '../aws';
import {
  checkPermission,
  getRolePermissions,
  getUserRoleInWorkspace,
  getWorkspace,
  id,
} from '../helpers/workspaceHelpers';
import { UserWorkspaceEntity, WorkspaceMemberEntity, WorkspaceEntity } from '../dynamo-types';

const TABLE_NAME = process.env.TABLE_NAME || 'mng-dev-data';

// Zod input validation schemas

const createWorkspaceInput = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  userId: z.string().min(1), // The user creating the workspace
});

const addMemberInput = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1), // User performing the action
  newMemberId: z.string().min(1), // User being added
  roleId: z.string().min(1), // Role to assign to new member
});

const removeMemberInput = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1), // User performing the action
  memberId: z.string().min(1), // User being removed
});

const deleteWorkspaceInput = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1), // User performing the action
});

export const workspaceRouter = router({
  /**
   * Get all workspaces the user belongs to
   */
  getUserWorkspaces: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        // Query USER#<userId> partition to get all WORKSPACE#<workspaceId> sort keys
        const res = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `USER#${input.userId}`,
              ':sk': 'WORKSPACE#',
            },
          }),
        );

        const userWorkspaces = (res.Items ?? []) as UserWorkspaceEntity[];

        // Fetch full workspace details for each
        const workspaces = await Promise.all(
          userWorkspaces.map(async (uw) => {
            const workspace = await getWorkspace(uw.workspaceId);
            const rolePerms = await getRolePermissions(uw.roleId);

            return {
              workspaceId: uw.workspaceId,
              name: workspace?.name ?? 'Unknown',
              description: workspace?.description,
              roleId: uw.roleId,
              permissions: rolePerms,
              joinedAt: uw.joinedAt,
            };
          }),
        );

        return { success: true, workspaces };
      } catch (error: any) {
        console.error('Error fetching user workspaces:', error);
        throw new Error(`Failed to fetch workspaces: ${error.message}`);
      }
    }),

  /**
   * Get workspace details including members
   */
  getWorkspace: publicProcedure
    .input(z.object({ workspaceId: z.string().min(1), userId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        // Check if user is a member
        const userRole = await getUserRoleInWorkspace(input.userId, input.workspaceId);
        if (!userRole) {
          throw new Error('You are not a member of this workspace');
        }

        // Get workspace metadata
        const workspace = await getWorkspace(input.workspaceId);
        if (!workspace) {
          throw new Error('Workspace not found');
        }

        // Get all members
        const membersRes = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `WORKSPACE#${input.workspaceId}`,
              ':sk': 'MEMBER#',
            },
          }),
        );

        const members = (membersRes.Items ?? []) as WorkspaceMemberEntity[];

        return {
          success: true,
          workspace: {
            ...workspace,
            members: members.map((m) => ({
              userId: m.userId,
              roleId: m.roleId,
              addedAt: m.addedAt,
            })),
          },
        };
      } catch (error: any) {
        console.error('Error fetching workspace:', error);
        throw new Error(`Failed to fetch workspace: ${error.message}`);
      }
    }),

  /**
   * Create a new workspace/team
   * Requires: User must exist (no permission check needed for creation)
   */
  createWorkspace: publicProcedure.input(createWorkspaceInput).mutation(async ({ input }) => {
    try {
      const now = new Date().toISOString();
      const workspaceId = id();

      // Get "Owner" role (users who create workspaces become owners)
      const ownerRoleRes = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': 'ROLENAME#owner',
            ':sk': 'ROLE#',
          },
          Limit: 1,
        }),
      );

      const ownerRoleRef = ownerRoleRes.Items?.[0] as { SK?: string } | undefined;
      if (!ownerRoleRef?.SK) {
        throw new Error('Owner role not found. Run seedDefaultRoles first.');
      }
      const ownerRoleId = ownerRoleRef.SK.slice('ROLE#'.length);

      // Create workspace metadata
      const workspace: WorkspaceEntity = {
        PK: `WORKSPACE#${workspaceId}`,
        SK: 'METADATA',
        workspaceId,
        name: input.name.trim(),
        description: input.description,
        ownerId: input.userId,
        createdAt: now,
        updatedAt: now,
      };

      // Create membership record (workspace → user)
      const member: WorkspaceMemberEntity = {
        PK: `WORKSPACE#${workspaceId}`,
        SK: `MEMBER#${input.userId}`,
        workspaceId,
        userId: input.userId,
        roleId: ownerRoleId,
        addedAt: now,
      };

      // Create reverse lookup (user → workspace)
      const userWorkspace: UserWorkspaceEntity = {
        PK: `USER#${input.userId}`,
        SK: `WORKSPACE#${workspaceId}`,
        userId: input.userId,
        workspaceId,
        roleId: ownerRoleId,
        joinedAt: now,
      };

      // Batch write all three items
      await doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: [
              { PutRequest: { Item: workspace } },
              { PutRequest: { Item: member } },
              { PutRequest: { Item: userWorkspace } },
            ],
          },
        }),
      );

      return {
        success: true,
        workspace: {
          workspaceId,
          name: workspace.name,
          description: workspace.description,
          ownerId: workspace.ownerId,
          roleId: ownerRoleId,
        },
        message: 'Workspace created successfully',
      };
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      throw new Error(`Failed to create workspace: ${error.message}`);
    }
  }),

  /**
   * Add a user to a workspace
   * Requires: team.add_member permission
   */
  addMember: publicProcedure.input(addMemberInput).mutation(async ({ input }) => {
    try {
      // Check permission
      const permCheck = await checkPermission(input.userId, input.workspaceId, 'team.add_member');

      if (!permCheck.allowed) {
        throw new Error(permCheck.reason ?? 'Permission denied');
      }

      // Check if member already exists
      const existing = await getUserRoleInWorkspace(input.newMemberId, input.workspaceId);
      if (existing) {
        throw new Error('User is already a member of this workspace');
      }

      const now = new Date().toISOString();

      // Create membership record
      const member: WorkspaceMemberEntity = {
        PK: `WORKSPACE#${input.workspaceId}`,
        SK: `MEMBER#${input.newMemberId}`,
        workspaceId: input.workspaceId,
        userId: input.newMemberId,
        roleId: input.roleId,
        addedAt: now,
      };

      // Create reverse lookup
      const userWorkspace: UserWorkspaceEntity = {
        PK: `USER#${input.newMemberId}`,
        SK: `WORKSPACE#${input.workspaceId}`,
        userId: input.newMemberId,
        workspaceId: input.workspaceId,
        roleId: input.roleId,
        joinedAt: now,
      };

      // Batch write
      await doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: [
              { PutRequest: { Item: member } },
              { PutRequest: { Item: userWorkspace } },
            ],
          },
        }),
      );

      return {
        success: true,
        message: 'Member added successfully',
        member: {
          userId: input.newMemberId,
          roleId: input.roleId,
          addedAt: now,
        },
      };
    } catch (error: any) {
      console.error('Error adding member:', error);
      throw new Error(`Failed to add member: ${error.message}`);
    }
  }),

  /**
   * Remove a user from a workspace
   * Requires: team.remove_member permission
   */
  removeMember: publicProcedure.input(removeMemberInput).mutation(async ({ input }) => {
    try {
      // Check permission
      const permCheck = await checkPermission(
        input.userId,
        input.workspaceId,
        'team.remove_member',
      );

      if (!permCheck.allowed) {
        throw new Error(permCheck.reason ?? 'Permission denied');
      }

      // Can't remove yourself if you're the owner
      const workspace = await getWorkspace(input.workspaceId);
      if (workspace?.ownerId === input.memberId) {
        throw new Error('Cannot remove workspace owner');
      }

      // Delete membership record and reverse lookup
      await doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: [
              {
                DeleteRequest: {
                  Key: {
                    PK: `WORKSPACE#${input.workspaceId}`,
                    SK: `MEMBER#${input.memberId}`,
                  },
                },
              },
              {
                DeleteRequest: {
                  Key: {
                    PK: `USER#${input.memberId}`,
                    SK: `WORKSPACE#${input.workspaceId}`,
                  },
                },
              },
            ],
          },
        }),
      );

      return {
        success: true,
        message: 'Member removed successfully',
      };
    } catch (error: any) {
      console.error('Error removing member:', error);
      throw new Error(`Failed to remove member: ${error.message}`);
    }
  }),

  /**
   * Delete a workspace
   * Requires: workspace.delete permission
   */
  deleteWorkspace: publicProcedure.input(deleteWorkspaceInput).mutation(async ({ input }) => {
    try {
      // Check permission
      const permCheck = await checkPermission(input.userId, input.workspaceId, 'workspace.delete');

      if (!permCheck.allowed) {
        throw new Error(permCheck.reason ?? 'Permission denied');
      }

      // Get all members to clean up reverse lookups
      const membersRes = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `WORKSPACE#${input.workspaceId}`,
            ':sk': 'MEMBER#',
          },
        }),
      );

      const members = (membersRes.Items ?? []) as WorkspaceMemberEntity[];

      // Build batch delete requests
      const deleteRequests: any[] = [
        // Delete workspace metadata
        {
          DeleteRequest: {
            Key: {
              PK: `WORKSPACE#${input.workspaceId}`,
              SK: 'METADATA',
            },
          },
        },
      ];

      // Delete all member records
      for (const member of members) {
        deleteRequests.push({
          DeleteRequest: {
            Key: {
              PK: `WORKSPACE#${input.workspaceId}`,
              SK: `MEMBER#${member.userId}`,
            },
          },
        });
        deleteRequests.push({
          DeleteRequest: {
            Key: {
              PK: `USER#${member.userId}`,
              SK: `WORKSPACE#${input.workspaceId}`,
            },
          },
        });
      }

      // Execute batch delete (DynamoDB limit is 25 per batch)
      for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        await doc.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: batch,
            },
          }),
        );
      }

      return {
        success: true,
        message: 'Workspace deleted successfully',
      };
    } catch (error: any) {
      console.error('Error deleting workspace:', error);
      throw new Error(`Failed to delete workspace: ${error.message}`);
    }
  }),
});
