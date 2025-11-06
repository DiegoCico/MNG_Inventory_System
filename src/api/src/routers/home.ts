import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import {
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { doc } from "../aws";

const TABLE_NAME = process.env.DDB_TABLE_NAME || "mng-dev-data";
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "mng-dev-uploads";
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

/* =============================================================================
   HELPERS
============================================================================= */

/** Get total stats from DynamoDB */
async function getInventorySummary(teamId: string) {
  const q = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TEAM#${teamId}`,
        ":sk": "ITEM#",
      },
    })
  );

  const items = q.Items ?? [];

  const totals = {
    toReview: 0,
    completed: 0,
    shortages: 0,
    damaged: 0,
  };

  const users: Record<
    string,
    { completed: number; shortages: number; damaged: number }
  > = {};

  for (const item of items) {
    const status = (item.status ?? "unreviewed").toLowerCase();
    const createdBy = item.createdBy ?? "unknown";

    if (status === "unreviewed") totals.toReview++;
    if (status === "completed") totals.completed++;
    if (status === "shortages" || status === "shortage") totals.shortages++;
    if (status === "damaged") totals.damaged++;

    // Count user contributions
    if (!users[createdBy]) {
      users[createdBy] = { completed: 0, shortages: 0, damaged: 0 };
    }
    if (status === "completed") users[createdBy].completed++;
    if (status === "shortages" || status === "shortage")
      users[createdBy].shortages++;
    if (status === "damaged") users[createdBy].damaged++;
  }

  const totalReviewed = totals.completed + totals.shortages + totals.damaged;
  const totalCount = totalReviewed + totals.toReview;
  const percentReviewed =
    totalCount > 0 ? Math.round((totalReviewed / totalCount) * 100) : 0;

  return { totals, percentReviewed, users, items };
}

/** Remove all items + images (HARD RESET) */
async function hardReset(teamId: string) {
  const q = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TEAM#${teamId}`,
        ":sk": "ITEM#",
      },
    })
  );
  const items = q.Items ?? [];

  for (const item of items) {
    await doc.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: item.PK, SK: item.SK },
      })
    );
  }

  const listed = await s3.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `items/${teamId}/`,
    })
  );

  if (listed.Contents && listed.Contents.length > 0) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: listed.Contents.map((obj) => ({ Key: obj.Key! })),
        },
      })
    );
  }

  return { success: true, message: "Hard reset completed." };
}

/** Soft reset — mark all items as unreviewed */
async function softReset(teamId: string) {
  const q = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TEAM#${teamId}`,
        ":sk": "ITEM#",
      },
    })
  );

  const items = q.Items ?? [];
  const now = new Date().toISOString();

  for (const item of items) {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: "SET #status = :s, updatedAt = :u",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":s": "unreviewed", ":u": now },
      })
    );
  }

  return { success: true, message: "Soft reset completed." };
}

export const homeRouter = router({
  /** DASHBOARD OVERVIEW */
  getDashboard: publicProcedure
    .input(z.object({ teamId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const { totals, percentReviewed, users } = await getInventorySummary(
          input.teamId
        );

        return {
          success: true,
          overview: {
            totals,
            percentReviewed,
            teamStats: Object.entries(users).map(([userId, data]) => ({
              userId,
              ...data,
            })),
          },
        };
      } catch (err: any) {
        console.error("❌ getDashboard error:", err);
        return { success: false, error: err.message };
      }
    }),

  /** HARD RESET — removes all items + images */
  hardReset: publicProcedure
    .input(z.object({ teamId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await hardReset(input.teamId);
      } catch (err: any) {
        console.error("❌ hardReset error:", err);
        return { success: false, error: err.message || "Failed to reset." };
      }
    }),

  /** SOFT RESET — mark all items as unreviewed */
  softReset: publicProcedure
    .input(z.object({ teamId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await softReset(input.teamId);
      } catch (err: any) {
        console.error("❌ softReset error:", err);
        return { success: false, error: err.message || "Failed to reset." };
      }
    }),
});
