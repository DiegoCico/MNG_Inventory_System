import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import { QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { doc } from '../aws';
import {
  checkPermission,
  getRolePermissions,
  getUserRoleInTeamspace,
  getTeamspace,
  id,
} from '../helpers/teamspaceHelpers';
import { UserTeamEntity, TeamMemberEntity, TeamEntity } from '../dynamo-types';

const TABLE_NAME = process.env.TABLE_NAME || 'mng-dev-data';

const createTeamspaceInput = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  userId: z.string().min(1), // The user creating the teamspace
});

const addMemberInput = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1), // User performing the action
  newMemberId: z.string().min(1), // User being added
  roleId: z.string().min(1), // Role to assign to new member
});

const removeMemberInput = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1), // User performing the action
  memberId: z.string().min(1), // User being removed
});

const deleteTeamspaceInput = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1), // User performing the action
});


export const teamspaceRouter = router({
  /**
   * Get all teamspaces the user belongs to
   */
  getUserTeamspaces: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        // Query USER#<userId> partition to get all TEAM#<teamId> sort keys
        const res = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `USER#${input.userId}`,
              ':sk': 'TEAM#',
            },
          }),
        );

        const userTeams = (res.Items ?? []) as UserTeamEntity[];

        // Fetch full teamspace details for each
        const teams = await Promise.all(
          userTeams.map(async (ut) => {
            const team = await getTeamspace(ut.teamId);
            const rolePerms = await getRolePermissions(ut.roleId);

            return {
              teamId: ut.teamId,
              name: team?.name ?? 'Unknown',
              description: team?.description,
              roleId: ut.roleId,
              permissions: rolePerms,
              joinedAt: ut.joinedAt,
            };
          }),
        );

        return { success: true, teams };
      } catch (error: any) {
        console.error('Error fetching user teamspaces:', error);
        throw new Error(`Failed to fetch teamspaces: ${error.message}`);
      }
    }),

  /**
   * Get teamspace details including members
   */
  getTeamspace: publicProcedure
    .input(z.object({ teamId: z.string().min(1), userId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        // Check if user is a member
        const userRole = await getUserRoleInTeamspace(input.userId, input.teamId);
        if (!userRole) {
          throw new Error('You are not a member of this teamspace');
        }

        // Get teamspace metadata
        const team = await getTeamspace(input.teamId);
        if (!team) {
          throw new Error('Teamspace not found');
        }

        // Get all members
        const membersRes = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `TEAM#${input.teamId}`,
              ':sk': 'MEMBER#',
            },
          }),
        );

        const members = (membersRes.Items ?? []) as TeamMemberEntity[];

        return {
          success: true,
          team: {
            ...team,
            members: members.map((m) => ({
              userId: m.userId,
              roleId: m.roleId,
              addedAt: m.addedAt,
            })),
          },
        };
      } catch (error: any) {
        console.error('Error fetching teamspace:', error);
        throw new Error(`Failed to fetch teamspace: ${error.message}`);
      }
    }),

  /**
   * Create a new teamspace
   * Requires: User must exist (no permission check needed for creation)
   * Enforces unique teamspace names via GSI_TeamByName
   */
  createTeamspace: publicProcedure.input(createTeamspaceInput).mutation(async ({ input }) => {
    try {
      const now = new Date().toISOString();
      const teamId = id();

      const normalizedName = input.name.trim().toLowerCase();

      const existing = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI_TeamByName',
          KeyConditionExpression: 'GSI_NAME = :n',
          ExpressionAttributeValues: { ':n': normalizedName },
          Limit: 1,
        }),
      );

      if (existing.Items && existing.Items.length > 0) {
        throw new Error(
          `A team named "${input.name}" already exists. Please choose a different name.`,
        );
      }

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
      if (!ownerRoleRef?.SK) throw new Error('Owner role not found. Run seedDefaultRoles first.');
      const ownerRoleId = ownerRoleRef.SK.slice('ROLE#'.length);

      // Teamspace metadata
      const team: TeamEntity = {
        PK: `TEAM#${teamId}`,
        SK: 'METADATA',
        teamId,
        name: input.name.trim(),
        normalizedName,
        description: input.description,
        ownerId: input.userId,
        createdAt: now,
        updatedAt: now,
        GSI_NAME: normalizedName, // for GSI_TeamByName lookup
      };

      // Team → Member record
      const member: TeamMemberEntity = {
        PK: `TEAM#${teamId}`,
        SK: `MEMBER#${input.userId}`,
        teamId,
        userId: input.userId,
        roleId: ownerRoleId,
        addedAt: now,
      };

      // User → Team reverse lookup
      const userTeam: UserTeamEntity = {
        PK: `USER#${input.userId}`,
        SK: `TEAM#${teamId}`,
        userId: input.userId,
        teamId,
        roleId: ownerRoleId,
        joinedAt: now,
      };

      await doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: [
              { PutRequest: { Item: team } },
              { PutRequest: { Item: member } },
              { PutRequest: { Item: userTeam } },
            ],
          },
        }),
      );

      return {
        success: true,
        team: {
          teamId,
          name: team.name,
          description: team.description,
          ownerId: team.ownerId,
          roleId: ownerRoleId,
        },
        message: 'Teamspace created successfully',
      };
    } catch (error: any) {
      console.error('Error creating teamspace:', error);
      throw new Error(`Failed to create teamspace: ${error.message}`);
    }
  }),

  /**
   * Add a member to a teamspace
   * Requires: team.add_member permission
   */
  addMember: publicProcedure.input(addMemberInput).mutation(async ({ input }) => {
    try {
      // Check permission
      const permCheck = await checkPermission(input.userId, input.teamId, 'team.add_member');
      if (!permCheck.allowed) throw new Error(permCheck.reason ?? 'Permission denied');

      // Check if member already exists
      const existing = await getUserRoleInTeamspace(input.newMemberId, input.teamId);
      if (existing) throw new Error('User is already a member of this teamspace');

      const now = new Date().toISOString();

      // Create membership record
      const member: TeamMemberEntity = {
        PK: `TEAM#${input.teamId}`,
        SK: `MEMBER#${input.newMemberId}`,
        teamId: input.teamId,
        userId: input.newMemberId,
        roleId: input.roleId,
        addedAt: now,
      };

      // Create reverse lookup
      const userTeam: UserTeamEntity = {
        PK: `USER#${input.newMemberId}`,
        SK: `TEAM#${input.teamId}`,
        userId: input.newMemberId,
        teamId: input.teamId,
        roleId: input.roleId,
        joinedAt: now,
      };

      // Batch write
      await doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: [
              { PutRequest: { Item: member } },
              { PutRequest: { Item: userTeam } },
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
   * Remove a user from a teamspace
   * Requires: team.remove_member permission
   */
  removeMember: publicProcedure.input(removeMemberInput).mutation(async ({ input }) => {
    try {
      // Check permission
      const permCheck = await checkPermission(input.userId, input.teamId, 'team.remove_member');
      if (!permCheck.allowed) throw new Error(permCheck.reason ?? 'Permission denied');

      // Can't remove the owner
      const team = await getTeamspace(input.teamId);
      if (team?.ownerId === input.memberId) {
        throw new Error('Cannot remove teamspace owner');
      }

      // Delete membership and reverse lookup
      await doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: [
              {
                DeleteRequest: { Key: { PK: `TEAM#${input.teamId}`, SK: `MEMBER#${input.memberId}` } },
              },
              {
                DeleteRequest: { Key: { PK: `USER#${input.memberId}`, SK: `TEAM#${input.teamId}` } },
              },
            ],
          },
        }),
      );

      return { success: true, message: 'Member removed successfully' };
    } catch (error: any) {
      console.error('Error removing member:', error);
      throw new Error(`Failed to remove member: ${error.message}`);
    }
  }),

  /**
   * Delete a teamspace
   * Requires: teamspace.delete permission
   */
  deleteTeamspace: publicProcedure.input(deleteTeamspaceInput).mutation(async ({ input }) => {
    try {
      // Check permission
      const permCheck = await checkPermission(input.userId, input.teamId, 'teamspace.delete');
      if (!permCheck.allowed) throw new Error(permCheck.reason ?? 'Permission denied');

      // Get all members to clean up reverse lookups
      const membersRes = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `TEAM#${input.teamId}`,
            ':sk': 'MEMBER#',
          },
        }),
      );

      const members = (membersRes.Items ?? []) as TeamMemberEntity[];

      // Build batch delete requests
      const deleteRequests: any[] = [
        { DeleteRequest: { Key: { PK: `TEAM#${input.teamId}`, SK: 'METADATA' } } },
      ];

      for (const member of members) {
        deleteRequests.push({
          DeleteRequest: { Key: { PK: `TEAM#${input.teamId}`, SK: `MEMBER#${member.userId}` } },
        });
        deleteRequests.push({
          DeleteRequest: { Key: { PK: `USER#${member.userId}`, SK: `TEAM#${input.teamId}` } },
        });
      }

      // Execute in DynamoDB 25-item batches
      for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        await doc.send(new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: batch } }));
      }

      return { success: true, message: 'Teamspace deleted successfully' };
    } catch (error: any) {
      console.error('Error deleting teamspace:', error);
      throw new Error(`Failed to delete teamspace: ${error.message}`);
    }
  }),
});
