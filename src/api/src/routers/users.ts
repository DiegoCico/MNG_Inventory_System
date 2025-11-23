import { z } from 'zod';
import { router, publicProcedure, permissionedProcedure } from './trpc';
import { ScanCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { doc } from '../aws';
import { loadConfig } from '../process';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

export const usersRouter = router({
  listUsersWithRoles: permissionedProcedure('user.assign_roles').query(async () => {
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
      userId: user.sub,
      username: user.username ?? 'Unknown',
      name: user.name ?? 'Unknown User',
      roleName: user.role ?? 'No Role',
    }));

    return { users };
  }),

  assignRole: permissionedProcedure('user.assign_roles')
    .input(
      z.object({
        userId: z.string(),
        roleName: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();
      const roleId = input.roleName.toUpperCase();

      const roleRes = await doc.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
        }),
      );

      if (!roleRes.Item) throw new Error('Role not found');

      await doc.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${input.userId}`,
            SK: 'METADATA',
          },
          UpdateExpression: 'SET #role = :roleName, updatedAt = :now',
          ExpressionAttributeNames: {
            '#role': 'role',
          },
          ExpressionAttributeValues: {
            ':roleName': input.roleName,
            ':now': now,
          },
        }),
      );

      return { success: true, roleName: input.roleName };
    }),

  getUserRole: permissionedProcedure('user.assign_roles')
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
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
        roleName: user.role ?? 'No Role',
      };
    }),
});
