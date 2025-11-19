import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { doc } from '../aws';
import { loadConfig } from '../process';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

function newId(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString('base64')
    .replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] as string);
}

/** Check if a user has a permission inside a specific teamspace */
async function hasPermission(userId: string, teamId: string, permission: string): Promise<boolean> {
  try {
    const res = await doc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `TEAM#${teamId}`, SK: `MEMBER#${userId}` },
      }),
    );
    const member = res.Item as { role?: string } | undefined;
    if (!member) return false;

    if (member.role?.toLowerCase() === 'owner') return true;

    const roleRes = await doc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `ROLENAME#${member.role?.toLowerCase()}`,
          SK: `ROLE#${member.role?.toUpperCase()}`,
        },
      }),
    );
    const role = roleRes.Item as { permissions?: string } | undefined;
    if (!role) return false;

    const perms: string[] = JSON.parse(role.permissions ?? '[]');
    return perms.includes(permission);
  } catch (err) {
    console.error('❌ hasPermission error:', err);
    return false;
  }
}

export const teamspaceRouter = router({
  /** CREATE TEAMSPACE */
  createTeamspace: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(60),
        description: z.string().max(280).optional(),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const cleanName = input.name.trim().toLowerCase();
        const now = new Date().toISOString();

        const dup = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI_WorkspaceByName',
            KeyConditionExpression: 'GSI_NAME = :n',
            ExpressionAttributeValues: { ':n': cleanName },
            Limit: 1,
          }),
        );
        if (dup.Items && dup.Items.length > 0) {
          return { success: false, error: 'A team with this name already exists.' };
        }

        const teamId = newId(12);

        const teamItem = {
          PK: `TEAM#${teamId}`,
          SK: 'METADATA',
          Type: 'Team',
          teamId,
          name: input.name,
          description: input.description ?? '',
          ownerId: input.userId,
          createdAt: now,
          updatedAt: now,
          GSI_NAME: cleanName,
        };

        const memberItem = {
          PK: `TEAM#${teamId}`,
          SK: `MEMBER#${input.userId}`,
          Type: 'TeamMember',
          teamId,
          userId: input.userId,
          role: 'Owner',
          joinedAt: now,
          GSI1PK: `USER#${input.userId}`,
          GSI1SK: `TEAM#${teamId}`,
        };

        await Promise.all([
          doc.send(new PutCommand({ TableName: TABLE_NAME, Item: teamItem })),
          doc.send(new PutCommand({ TableName: TABLE_NAME, Item: memberItem })),
        ]);

        return { success: true, teamId, name: input.name };
      } catch (err: any) {
        console.error('❌ createTeamspace error:', err);
        return { success: false, error: err.message || 'Failed to create teamspace.' };
      }
    }),

  /** GET TEAMSPACES */
  getTeamspace: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const q = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI_UserTeams',
            KeyConditionExpression: 'GSI1PK = :uid',
            ExpressionAttributeValues: { ':uid': `USER#${input.userId}` },
          }),
        );

        const memberships = q.Items ?? [];
        if (!memberships.length) return { success: true, teams: [] };

        const teams = await Promise.all(
          memberships.map(async (m) => {
            const res = await doc.send(
              new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: `TEAM#${m.teamId}`, SK: 'METADATA' },
              }),
            );
            return res.Item;
          }),
        );

        return { success: true, teams };
      } catch (err: any) {
        console.error('❌ getTeamspace error:', err);
        return { success: false, error: err.message || 'Failed to fetch teams.' };
      }
    }),

  /** ADD USER TO TEAMSPACE */
  addUserTeamspace: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        memberUsername: z.string().min(1),
        inviteWorkspaceId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // lookup user by username using GSI_UsersByUsername
        const q = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI_UsersByUsername',
            KeyConditionExpression: 'username = :u',
            ExpressionAttributeValues: { ':u': input.memberUsername.trim() },
            Limit: 1,
          }),
        );

        const user = q.Items?.[0];
        if (!user) {
          return { success: false, error: 'User not found by username.' };
        }

        // IMPORTANT FIX:
        // Use Cognito's real user identifier: user.sub
        const targetId = user.sub;

        const now = new Date().toISOString();

        const member = {
          PK: `TEAM#${input.inviteWorkspaceId}`,
          SK: `MEMBER#${targetId}`,
          Type: 'TeamMember',
          teamId: input.inviteWorkspaceId,
          userId: targetId,
          role: 'Member',
          joinedAt: now,

          // Correct GSI so getTeamspace works
          GSI1PK: `USER#${targetId}`,
          GSI1SK: `TEAM#${input.inviteWorkspaceId}`,
        };

        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: member }));

        return { success: true, added: user.username };
      } catch (err: any) {
        console.error('❌ addUserTeamspace error:', err);
        return {
          success: false,
          error: err.message || 'Failed to add member.',
        };
      }
    }),
  /** REMOVE USER FROM TEAMSPACE */
  removeUserTeamspace: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        memberUsername: z.string().min(1),
        inviteWorkspaceId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const allowed = await hasPermission(
          input.userId,
          input.inviteWorkspaceId,
          'team.remove_member',
        );
        if (!allowed) {
          return { success: false, error: 'Not authorized to remove members.' };
        }

        // 🔍 lookup user by username
        const q = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI_UsersByUsername',
            KeyConditionExpression: 'username = :u',
            ExpressionAttributeValues: { ':u': input.memberUsername.trim() },
            Limit: 1,
          }),
        );

        const target = q.Items?.[0];
        if (!target) {
          return { success: false, error: 'User not found by username.' };
        }

        // Delete membership record
        await doc.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: `TEAM#${input.inviteWorkspaceId}`,
              SK: `MEMBER#${target.accountId}`,
            },
          }),
        );

        return { success: true, removed: target.username };
      } catch (err: any) {
        console.error('❌ removeUserTeamspace error:', err);
        return {
          success: false,
          error: err.message || 'Failed to remove member.',
        };
      }
    }),

  /** DELETE TEAMSPACE */
  deleteTeamspace: publicProcedure
    .input(
      z.object({
        inviteWorkspaceId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const allowed = await hasPermission(
          input.userId,
          input.inviteWorkspaceId,
          'workspace.delete',
        );
        if (!allowed) {
          return { success: false, error: 'Not authorized to delete team.' };
        }

        const q = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: { ':pk': `TEAM#${input.inviteWorkspaceId}` },
          }),
        );

        const items = q.Items ?? [];
        await Promise.all(
          items.map((it) =>
            doc.send(
              new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { PK: it.PK, SK: it.SK },
              }),
            ),
          ),
        );

        return { success: true, deleted: input.inviteWorkspaceId };
      } catch (err: any) {
        console.error('❌ deleteTeamspace error:', err);
        return { success: false, error: err.message || 'Failed to delete teamspace.' };
      }
    }),
});
