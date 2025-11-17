import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import { parseCookiesFromCtx, COOKIE_ACCESS } from '../helpers/cookies';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { loadConfig } from '../process';
import { doc } from '../aws';
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

const verifier = CognitoJwtVerifier.create({
  userPoolId: config.COGNITO_USER_POOL_ID,
  clientId: config.COGNITO_CLIENT_ID,
  tokenUse: 'access',
});

function randomUsername(): string {
  return 'user-' + Math.random().toString(36).substring(2, 8);
}

async function ensureUniqueUsername(base: string): Promise<string> {
  let username = base;
  let counter = 1;

  while (true) {
    const res = await doc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI_UsersByUsername',
        KeyConditionExpression: 'username = :u',
        ExpressionAttributeValues: { ':u': username },
        Limit: 1,
      }),
    );

    if (!res.Items || res.Items.length === 0) return username;

    username = `${base}${counter}`;
    counter++;
  }
}

export const profileRouter = router({
  getProfile: publicProcedure.query(async ({ ctx }) => {
    const cookies = parseCookiesFromCtx(ctx);
    const token = cookies[COOKIE_ACCESS];

    if (!token) return { authenticated: false, message: 'No session' };

    try {
      const decoded = await verifier.verify(token);
      const userId = decoded.sub;

      // FETCH USER RECORD
      const userRes = await doc.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: 'METADATA' },
        }),
      );

      let user = userRes.Item;

      // CREATE USER IF MISSING
      if (!user) {
        const now = new Date().toISOString();

        let generated = await ensureUniqueUsername(randomUsername());

        user = {
          PK: `USER#${userId}`,
          SK: 'METADATA',
          sub: userId,
          username: generated,
          name: generated,
          role: 'User',
          createdAt: now,
          updatedAt: now,
          GSI6PK: `UID#${userId}`,
          GSI6SK: `USER#${userId}`,
        };

        await doc.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: user,
          }),
        );
      }
      // -----------------------------
      // TEAM LOOKUP
      // -----------------------------
      const teamRes = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI_UserTeams',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: { ':pk': `USER#${userId}` },
          Limit: 1,
        }),
      );

      const teamItem = teamRes.Items?.[0];
      const teamName = teamItem?.teamName ?? 'No Team Assigned';

      return {
        authenticated: true,
        userId,
        username: user.username,
        name: user.name,
        role: user.role,
        team: teamName,
      };
    } catch (err) {
      console.error('❌ getProfile error:', err);
      return { authenticated: false, message: 'Invalid session' };
    }
  }),

  updateProfile: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().optional(),
        username: z.string().optional(),
        role: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const existing = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${input.userId}`, SK: 'METADATA' },
          }),
        );

        if (!existing.Item) return { success: false, message: 'User not found' };

        const updates: string[] = [];
        const vars: Record<string, any> = {};
        const names: Record<string, string> = {};

        // USERNAME UPDATE (only if changed AND not empty)
        if (
          input.username &&
          input.username.trim() &&
          input.username.trim() !== existing.Item.username
        ) {
          const clean = input.username.trim().replace(/[^a-zA-Z0-9_-]/g, '');
          const unique = await ensureUniqueUsername(clean);

          updates.push('#un = :username');
          names['#un'] = 'username';
          vars[':username'] = unique;
        }

        // NAME UPDATE
        if (input.name && input.name.trim() && input.name !== existing.Item.name) {
          updates.push('#nm = :name');
          names['#nm'] = 'name';
          vars[':name'] = input.name.trim();
        }

        // ROLE UPDATE
        if (input.role && input.role.trim() && input.role !== existing.Item.role) {
          updates.push('#rl = :role');
          names['#rl'] = 'role';
          vars[':role'] = input.role.trim();
        }

        // No updates?
        if (updates.length === 0) {
          return { success: true, message: 'No changes' };
        }

        // Always update timestamp
        updates.push('updatedAt = :updatedAt');
        vars[':updatedAt'] = new Date().toISOString();

        await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${input.userId}`, SK: 'METADATA' },
            UpdateExpression: `SET ${updates.join(', ')}`,
            ExpressionAttributeValues: vars,
            ExpressionAttributeNames: names,
          }),
        );

        return { success: true, message: 'Profile updated' };
      } catch (err) {
        console.error('❌ updateProfile error:', err);
        return { success: false, message: 'Failed to update profile' };
      }
    }),
});
