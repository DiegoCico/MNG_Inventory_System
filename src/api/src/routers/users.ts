import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import { ScanCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { doc } from '../aws';
import { loadConfig } from '../process';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

export const usersRouter = router({
  // List all users with their current roles (search done client-side)
  listUsersWithRoles: publicProcedure.query(async () => {
    // Scan for all USER# entities with SK=METADATA
    const usersRes = await doc.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'USER#',
          ':sk': 'METADATA',
        },
      }),
    );

    const users = (usersRes.Items ?? []).map((user) => ({
      userId: user.sub, // Cognito user ID
      username: user.username ?? 'Unknown',
      name: user.name ?? 'Unknown User',
      roleName: user.role ?? 'No Role', // Role name is the PK
    }));

    return { users };
  }),

  /** Assign a role to a user */
  assignRole: publicProcedure
    .input(
      z.object({
        userId: z.string(), // Cognito sub
        roleName: z.string(), // Role name (PK)
      }),
    )
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();

      // Verify the role exists by looking up ROLE#{roleName}
      const roleRes = await doc.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ROLE#${input.roleName}`, SK: 'METADATA' },
        }),
      );

      const role = roleRes.Item;
      if (!role) throw new Error('Role not found');

      // Update user with role name
      await doc.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${input.userId}`,
            SK: 'METADATA',
          },
          UpdateExpression: 'SET #role = :roleName, updatedAt = :now',
          ExpressionAttributeNames: {
            '#role': 'role', // role is a reserved word
          },
          ExpressionAttributeValues: {
            ':roleName': input.roleName,
            ':now': now,
          },
        }),
      );

      return { success: true, roleName: input.roleName };
    }),

  // Get a user's current role
  getUserRole: publicProcedure.input(z.object({ userId: z.string() })).query(async ({ input }) => {
    const userRes = await doc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${input.userId}`, SK: 'METADATA' },
      }),
    );

    const user = userRes.Item;
    if (!user) throw new Error('User not found');

    return {
      userId: input.userId,
      roleName: user.role ?? 'No Role', // role field contains the role name
    };
  }),
});
