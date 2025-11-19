import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import { QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { doc } from '../aws';
import { loadConfig } from '../process';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;
const BUCKET_NAME = config.BUCKET_NAME;
const REGION = config.REGION;

const s3 = new S3Client({ region: REGION });

// HARD RESET — Delete all items and images for a team
async function hardReset(teamId: string) {
  const q = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TEAM#${teamId}`,
        ':sk': 'ITEM#',
      },
    }),
  );

  const items = q.Items ?? [];

  // Delete all DynamoDB items
  for (const item of items) {
    await doc.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: item.PK, SK: item.SK },
      }),
    );
  }

  // Delete all S3 objects under team prefix
  const listed = await s3.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `items/${teamId}/`,
    }),
  );

  if (listed.Contents && listed.Contents.length > 0) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: listed.Contents.map((obj) => ({ Key: obj.Key! })),
        },
      }),
    );
  }

  return { success: true, message: 'Hard reset completed.' };
}

async function softReset(teamId: string) {
  const q = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TEAM#${teamId}`,
        ':sk': 'ITEM#',
      },
    }),
  );

  const items = q.Items ?? [];
  const now = new Date().toISOString();

  for (const item of items) {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: 'SET #status = :s, updatedAt = :u',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':s': 'To Review', ':u': now },
      }),
    );
  }

  return { success: true, message: 'Soft reset completed.' };
}

export const homeRouter = router({
  /** HARD RESET — deletes all items + images */
  hardReset: publicProcedure
    .input(z.object({ teamId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await hardReset(input.teamId);
      } catch (err: any) {
        console.error('❌ hardReset error:', err);
        return { success: false, error: err.message || 'Failed to reset.' };
      }
    }),

  /** SOFT RESET — marks all as 'Incomplete' */
  softReset: publicProcedure
    .input(z.object({ teamId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await softReset(input.teamId);
      } catch (err: any) {
        console.error('❌ softReset error:', err);
        return { success: false, error: err.message || 'Failed to reset.' };
      }
    }),
});
