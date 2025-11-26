import { z } from 'zod';
import { router, publicProcedure, permissionedProcedure, protectedProcedure } from './trpc';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { doc } from '../aws';
import { loadConfig } from '../process';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

function newId(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString('base64')
    .replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] as string);
}

export const teamspaceRouter = router({
  /** CREATE TEAMSPACE */
  createTeamspace: permissionedProcedure('team.create')
    .input(
      z.object({
        name: z.string().min(2).max(60),
        description: z.string().min(1), // LOCATION
        uic: z.string().min(1),
        fe: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const cleanName = input.name.trim().toLowerCase();
        const now = new Date().toISOString();

        // Check duplicate name
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

        /** TEAM METADATA RECORD */
        const teamItem = {
          PK: `TEAM#${teamId}`,
          SK: 'METADATA',
          Type: 'Team',
          teamId,
          name: input.name,

          // LOCATION
          description: input.description,

          // NEW FIELDS
          uic: input.uic,
          fe: input.fe,

          ownerId: input.userId,
          createdAt: now,
          updatedAt: now,
          GSI_NAME: cleanName,
        };

        /** MEMBERSHIP RECORD FOR OWNER */
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
getTeamspace: permissionedProcedure('team.view')
  .input(z.object({ userId: z.string().min(1) }))
  .query(async ({ input }) => {
    try {
      // 1. Get memberships
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

      // 2. Fetch team metadata + compute status %
      const teams = await Promise.all(
        memberships.map(async (m) => {
          const teamId = m.teamId;

          // --- Fetch team metadata ---
          const metaRes = await doc.send(
            new GetCommand({
              TableName: TABLE_NAME,
              Key: { PK: `TEAM#${teamId}`, SK: 'METADATA' },
            }),
          );

          const team = metaRes.Item;
          if (!team) return null;

          // --- Fetch all tasks (items) ---
          const itemsRes = await doc.send(
            new QueryCommand({
              TableName: TABLE_NAME,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
              ExpressionAttributeValues: {
                ':pk': `TEAM#${teamId}`,
                ':sk': 'ITEM#',
              },
            }),
          );

          const items = itemsRes.Items ?? [];

          // --- Count statuses (MATCH EXACT STRINGS USED IN itemsRouter) ---
          let toReview = 0;
          let completed = 0;
          let shortages = 0;
          let damaged = 0;

          for (const item of items) {
            const s = (item.status ?? "").toLowerCase();

            if (s === "to review") toReview++;
            else if (s === "completed") completed++;
            else if (s === "shortages") shortages++;
            else if (s === "damaged") damaged++;
          }

          const total = items.length || 1;

          // percent done = Completed / total
          const percent = Math.round((completed / total) * 100);

          return {
            ...team,
            percent,
            totals: {
              toReview,
              completed,
              shortages,
              damaged,
            },
          };
        }),
      );

      return { success: true, teams: teams.filter(Boolean) };
    } catch (err: any) {
      console.error("❌ getTeamspace error:", err);
      return { success: false, error: err.message || "Failed to fetch teams." };
    }
  }),

  /** GET SINGLE TEAM BY ID */
  getTeamById: publicProcedure
    .input(z.object({ teamId: z.string().min(1), userId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        // Check if user is a member of this team (any role/permission grants access to view)
        const memberCheck = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `MEMBER#${input.userId}` },
          }),
        );

        if (!memberCheck.Item) {
          return { success: false, error: 'Not authorized to view this team.' };
        }

        // Get team metadata
        const res = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: 'METADATA' },
          }),
        );

        if (!res.Item) {
          return { success: false, error: 'Team not found.' };
        }

        return { success: true, team: res.Item };
      } catch (err: any) {
        console.error('❌ getTeamById error:', err);
        return { success: false, error: err.message || 'Failed to fetch team.' };
      }
    }),

  /** ADD USER TO TEAMSPACE */
  addUserTeamspace: permissionedProcedure('team.add_member')
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
removeUserTeamspace: permissionedProcedure('team.remove_member')
  .input(
    z.object({
      userId: z.string().min(1),
      memberUsername: z.string().min(1),
      inviteWorkspaceId: z.string().min(1),
    }),
  )
  .mutation(async ({ input }) => {
    try {
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

      const userIdToRemove = target.sub;

      await doc.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `TEAM#${input.inviteWorkspaceId}`,
            SK: `MEMBER#${userIdToRemove}`,
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
  deleteTeamspace: permissionedProcedure('team.delete')
    .input(
      z.object({
        inviteWorkspaceId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const q = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
              ':pk': `TEAM#${input.inviteWorkspaceId}`,
            },
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

        const s3 = new S3Client({ region: config.REGION });

        const prefix = `items/${input.inviteWorkspaceId}/`;

        const listed = await s3.send(
          new ListObjectsV2Command({
            Bucket: config.BUCKET_NAME,
            Prefix: prefix,
          }),
        );

        const contents = listed.Contents ?? [];

        if (contents.length > 0) {
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: config.BUCKET_NAME,
              Delete: {
                Objects: contents.map((o) => ({ Key: o.Key! })),
              },
            }),
          );
        }

        return { success: true, deleted: input.inviteWorkspaceId };
      } catch (err: any) {
        console.error('❌ deleteTeamspace error:', err);
        return { success: false, error: err.message || 'Failed to delete teamspace.' };
      }
    }),
  /** GET ALL USERS */
  getAllUsers: protectedProcedure.query(async () => {
    try {
      const res = await doc.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
          ExpressionAttributeValues: {
            ':pk': 'USER#',
            ':sk': 'METADATA',
          },
        }),
      );

      const rawUsers = res.Items ?? [];
      const users = [];

      for (const u of rawUsers) {
        const userId = u.sub ?? u.userId;

        // 1. Fetch teams the user belongs to
        const teamsRes = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI_UserTeams',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: {
              ':pk': `USER#${userId}`,
            },
          }),
        );

        const teamItems = teamsRes.Items ?? [];
        const teams: any[] = [];

        // 2. For each membership, fetch TEAM metadata to get teamName
        for (const t of teamItems) {
          const teamId = t.teamId ?? t.GSI1SK?.replace('TEAM#', '');

          // Get TEAM#<id> METADATA
          const metaRes = await doc.send(
            new GetCommand({
              TableName: TABLE_NAME,
              Key: {
                PK: `TEAM#${teamId}`,
                SK: 'METADATA',
              },
            }),
          );

          const meta = metaRes.Item || {};

          teams.push({
            teamId,
            teamName: meta.GSI_NAME ?? meta.name ?? '',
            role: t.role,
          });
        }

        users.push({
          userId,
          username: u.username,
          name: u.name ?? '',
          teams,
        });
      }

      return { success: true, users };
    } catch (err: any) {
      console.error('❌ getAllUsers error:', err);
      return {
        success: false,
        error: err.message || 'Failed to fetch all users.',
      };
    }
  }),
  /** GET ALL MEMBERS OF A TEAM */
  getTeamMembers: permissionedProcedure('team.view')
    .input(
      z.object({
        teamId: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Get all TEAM#<id> items
        const q = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: { ':pk': `TEAM#${input.teamId}` },
          }),
        );

        const items = q.Items ?? [];
        const members = items.filter((it) => it.SK.startsWith('MEMBER#'));

        const enriched = await Promise.all(
          members.map(async (m) => {
            const userId = m.userId;

            // Fetch full USER metadata 
            const userRes = await doc.send(
              new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: `USER#${userId}`, SK: 'METADATA' },
              }),
            );

            const user = userRes.Item || {};

            // The ONE TRUE GLOBAL USER ROLE
            const globalRoleName = user.role ?? 'No Role';
            const roleId = globalRoleName.toUpperCase();

            // Fetch global role metadata
            const roleRes = await doc.send(
              new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                  PK: `ROLE#${roleId}`,
                  SK: 'METADATA',
                },
              }),
            );

            const roleData = roleRes.Item || {};

            return {
              userId,
              username: user.username ?? '',
              name: user.name ?? '',
              roleName: globalRoleName,         
              roleId,                            
              permissions: roleData.permissions ?? [],
              joinedAt: m.joinedAt,
            };
          }),
        );

        return { success: true, members: enriched };
      } catch (err: any) {
        console.error('❌ getTeamMembers error:', err);
        return {
          success: false,
          error: err.message || 'Failed to fetch team members.',
        };
      }
    }),

});
