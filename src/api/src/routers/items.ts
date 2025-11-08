import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { doc } from "../aws";
import { loadConfig } from "../process";

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;
const BUCKET_NAME = config.BUCKET_NAME;
const REGION = config.REGION;
const KMS_KEY_ARN = config.KMS_KEY_ARN;

if (!BUCKET_NAME) throw new Error("❌ Missing S3 bucket name");
const s3 = new S3Client({ region: REGION });

function newId(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString("base64")
    .replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c] as string));
}

function getImageExtension(base64: string): string {
  const match = base64.match(/^data:image\/(\w+);base64,/);
  return match ? match[1].toLowerCase() : "png";
}

function stripBase64Header(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, "");
}

/**
 * Try to find the first matching S3 image and return a signed URL
 */
async function resolveS3ImageLink(teamId: string, nsn: string): Promise<string | undefined> {
  const exts = ["png", "jpg", "jpeg", "webp", "heic"];
  for (const ext of exts) {
    const key = `items/${teamId}/${nsn}.${ext}`;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
        { expiresIn: 3600 } // 1 hour
      );
      console.log(`[S3] ✅ Signed URL generated for ${key}`);
      return signedUrl;
    } catch (err: any) {
      if (err.$metadata?.httpStatusCode !== 404)
        console.warn(`[S3] ⚠️ Failed checking ${key}:`, err.message);
      continue;
    }
  }
  console.log(`[S3] ❌ No image found for ${teamId}/${nsn}`);
  return undefined;
}
export const itemsRouter = router({
  createItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        actualName: z.string().optional(),
        nsn: z.string(),
        serialNumber: z.string().optional(),
        quantity: z.number().default(1),
        userId: z.string().min(1),
        imageBase64: z.string().optional(),
        damageReports: z.array(z.string()).optional(),
        status: z.string().optional(),
        parent: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Check duplicates
        const existing = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
              ":pk": `TEAM#${input.teamId}`,
              ":sk": "ITEM#",
            },
          })
        );

        const duplicate = (existing.Items ?? []).find(
          (item: any) =>
            item.nsn &&
            item.nsn.trim().toLowerCase() === input.nsn.trim().toLowerCase()
        );

        if (duplicate) {
          return {
            success: false,
            error: `An item with NSN "${input.nsn}" already exists in this team.`,
          };
        }

        const itemId = newId(12);
        const now = new Date().toISOString();
        let imageLink: string | undefined;

        if (input.imageBase64 && input.nsn) {
          const ext = getImageExtension(input.imageBase64);
          const key = `items/${input.teamId}/${input.nsn}.${ext}`;
          const body = Buffer.from(stripBase64Header(input.imageBase64), "base64");

          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
              Body: body,
              ContentEncoding: "base64",
              ContentType: `image/${ext}`,
              ...(KMS_KEY_ARN
                ? {
                    ServerSideEncryption: "aws:kms",
                    SSEKMSKeyId: KMS_KEY_ARN,
                  }
                : {}),
            })
          );

          imageLink = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
            { expiresIn: 3600 }
          );
        }

        const item = {
          PK: `TEAM#${input.teamId}`,
          SK: `ITEM#${itemId}`,
          Type: "Item",
          teamId: input.teamId,
          itemId,
          name: input.name,
          actualName: input.actualName,
          nsn: input.nsn,
          serialNumber: input.serialNumber,
          quantity: input.quantity,
          description: input.description,
          imageLink,
          damageReports: input.damageReports ?? [],
          status: input.status || "Incomplete",
          parent: input.parent ?? null,
          createdAt: now,
          updatedAt: now,
          createdBy: input.userId,
          updateLog: [
            { userId: input.userId, action: "create", timestamp: now },
          ],
        };

        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
        return { success: true, itemId, item };
      } catch (err: any) {
        console.error("❌ createItem error:", err);
        return { success: false, error: err.message || "Failed to create item." };
      }
    }),
  getItems: publicProcedure
    .input(z.object({ teamId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
              ":pk": `TEAM#${input.teamId}`,
              ":sk": "ITEM#",
            },
          })
        );

        type ItemRecord = {
          itemId: string;
          parent?: string | null;
          children?: ItemRecord[];
          [key: string]: any;
        };

        const items: ItemRecord[] = await Promise.all(
          (result.Items ?? []).map(async (raw: any) => {
            let imageLink = raw.imageLink;
            if (!imageLink && raw.nsn) {
              imageLink = await resolveS3ImageLink(raw.teamId, raw.nsn);
            }
            return { ...raw, imageLink } as ItemRecord;
          })
        );

        // Build hierarchy
        const map: Record<string, ItemRecord> = {};
        const roots: ItemRecord[] = [];
        for (const item of items) map[item.itemId] = { ...item, children: [] };
        for (const item of items) {
          const parentId = item.parent;
          if (parentId && map[parentId])
            map[parentId].children!.push(map[item.itemId]);
          else roots.push(map[item.itemId]);
        }

        return { success: true, items: roots };
      } catch (err: any) {
        console.error("❌ getItems error:", err);
        return { success: false, error: err.message };
      }
    }),
  getItem: publicProcedure
    .input(z.object({ teamId: z.string(), itemId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${input.itemId}` },
          })
        );

        if (!result.Item) return { success: false, error: "Item not found" };
        const item = result.Item;

        let imageLink = item.imageLink;
        if (!imageLink && item.nsn)
          imageLink = await resolveS3ImageLink(item.teamId, item.nsn);

        const q = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
              ":pk": `TEAM#${input.teamId}`,
              ":sk": "ITEM#",
            },
          })
        );

        const children = (q.Items ?? []).filter(
          (child) => child.parent === input.itemId
        );

        return { success: true, item: { ...item, imageLink, children } };
      } catch (err: any) {
        console.error("❌ getItem error:", err);
        return { success: false, error: err.message };
      }
    }),
  updateItem: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        itemId: z.string(),
        userId: z.string(),
        name: z.string().optional(),
        actualName: z.string().optional(),
        nsn: z.string(),
        serialNumber: z.string().optional(),
        quantity: z.number().optional(),
        description: z.string().optional(),
        imageLink: z.string().optional(),
        status: z.string().optional(),
        damageReports: z.array(z.string()).optional(),
        parent: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const now = new Date().toISOString();
        const updates: string[] = ["updatedAt = :updatedAt"];
        const values: Record<string, any> = { ":updatedAt": now };
        const names: Record<string, string> = {};

        if (input.name !== undefined) {
          updates.push("#name = :name");
          values[":name"] = input.name;
          names["#name"] = "name";
        }
        if (input.actualName !== undefined) {
          updates.push("actualName = :actualName");
          values[":actualName"] = input.actualName;
        }
        if (input.nsn !== undefined) {
          const existing = await doc.send(
            new QueryCommand({
              TableName: TABLE_NAME,
              KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
              ExpressionAttributeValues: {
                ":pk": `TEAM#${input.teamId}`,
                ":sk": "ITEM#",
              },
            })
          );
          const duplicate = (existing.Items ?? []).find(
            (i: any) =>
              i.nsn &&
              i.itemId !== input.itemId &&
              i.nsn.trim().toLowerCase() === input.nsn.trim().toLowerCase()
          );
          if (duplicate)
            return {
              success: false,
              error: `Another item with NSN "${input.nsn}" already exists.`,
            };

          updates.push("nsn = :nsn");
          values[":nsn"] = input.nsn;
        }
        if (input.serialNumber !== undefined) {
          updates.push("serialNumber = :serialNumber");
          values[":serialNumber"] = input.serialNumber;
        }
        if (input.quantity !== undefined) {
          updates.push("quantity = :quantity");
          values[":quantity"] = input.quantity;
        }
        if (input.description !== undefined) {
          updates.push("description = :description");
          values[":description"] = input.description;
        }
        if (input.imageLink !== undefined) {
          updates.push("imageLink = :imageLink");
          values[":imageLink"] = input.imageLink;
        }
        if (input.status !== undefined) {
          updates.push("#status = :status");
          values[":status"] = input.status;
          names["#status"] = "status";
        }
        if (input.damageReports !== undefined) {
          updates.push("damageReports = :damageReports");
          values[":damageReports"] = input.damageReports;
        }
        if (input.parent !== undefined) {
          updates.push("parent = :parent");
          values[":parent"] = input.parent;
        }

        updates.push(
          "updateLog = list_append(if_not_exists(updateLog, :empty), :log)"
        );
        values[":log"] = [
          { userId: input.userId, action: "update", timestamp: now },
        ];
        values[":empty"] = [];

        const result = await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${input.itemId}` },
            UpdateExpression: `SET ${updates.join(", ")}`,
            ExpressionAttributeValues: values,
            ExpressionAttributeNames:
              Object.keys(names).length ? names : undefined,
            ReturnValues: "ALL_NEW",
          })
        );
        return { success: true, item: result.Attributes };
      } catch (err: any) {
        console.error("❌ updateItem error:", err);
        return { success: false, error: err.message };
      }
    }),
  deleteItem: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        itemId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await doc.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${input.itemId}` },
          })
        );

        // Delete children
        const q = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
              ":pk": `TEAM#${input.teamId}`,
              ":sk": "ITEM#",
            },
          })
        );
        const children = (q.Items ?? []).filter(
          (child) => child.parent === input.itemId
        );
        for (const child of children) {
          await doc.send(
            new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { PK: child.PK, SK: child.SK },
            })
          );
        }
        return { success: true, deleted: input.itemId };
      } catch (err: any) {
        console.error("❌ deleteItem error:", err);
        return { success: false, error: err.message };
      }
    }),
  uploadImage: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        nsn: z.string(),
        imageBase64: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const ext = getImageExtension(input.imageBase64);
        const key = `items/${input.teamId}/${input.nsn}.${ext}`;
        const body = Buffer.from(stripBase64Header(input.imageBase64), "base64");

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: body,
            ContentEncoding: "base64",
            ContentType: `image/${ext}`,
            ...(KMS_KEY_ARN
              ? {
                  ServerSideEncryption: "aws:kms",
                  SSEKMSKeyId: KMS_KEY_ARN,
                }
              : {}),
          })
        );

        const signedUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
          { expiresIn: 3600 }
        );

        return { success: true, imageLink: signedUrl };
      } catch (err: any) {
        console.error("❌ uploadImage error:", err);
        return { success: false, error: err.message };
      }
    }),
});

export type ItemsRouter = typeof itemsRouter;
