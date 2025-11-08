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

/* ============================================================
   HELPERS
============================================================ */
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

async function resolveS3ImageLink(teamId: string, nsn: string): Promise<string | undefined> {
  const exts = ["png", "jpg", "jpeg", "webp", "heic"];
  for (const ext of exts) {
    const key = `items/${teamId}/${nsn}.${ext}`;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
        { expiresIn: 3600 }
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

/* ============================================================
   ROUTER
============================================================ */
export const itemsRouter = router({
  /** CREATE ITEM **/
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
      console.log(`[createItem] Received:`, JSON.stringify(input, null, 2));
      try {
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
        console.log(`[createItem] Found ${existing.Items?.length || 0} existing items.`);

        const duplicate = (existing.Items ?? []).find(
          (item: any) =>
            item.nsn &&
            item.nsn.trim().toLowerCase() === input.nsn.trim().toLowerCase()
        );

        if (duplicate) {
          console.warn(`[createItem] ❌ Duplicate NSN "${input.nsn}" found.`);
          return {
            success: false,
            error: `An item with NSN "${input.nsn}" already exists.`,
          };
        }

        const itemId = newId(12);
        const now = new Date().toISOString();
        let imageLink: string | undefined;

        if (input.imageBase64 && input.nsn) {
          const ext = getImageExtension(input.imageBase64);
          const key = `items/${input.teamId}/${input.nsn}.${ext}`;
          const body = Buffer.from(stripBase64Header(input.imageBase64), "base64");

          console.log(`[createItem] Uploading image to ${key}...`);
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
          console.log(`[createItem] ✅ Image uploaded successfully.`);
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
          updateLog: [{ userId: input.userId, action: "create", timestamp: now }],
        };

        console.log(`[createItem] Writing item to DynamoDB:`, JSON.stringify(item, null, 2));
        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

        return { success: true, itemId, item };
      } catch (err: any) {
        console.error(`❌ createItem error:`, err);
        return { success: false, error: err.message };
      }
    }),

  /** GET ITEMS **/
  getItems: publicProcedure
    .input(z.object({ teamId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      console.log(`[getItems] Fetching items for team ${input.teamId}`);
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
        console.log(`[getItems] Retrieved ${result.Items?.length || 0} items.`);

        const items = await Promise.all(
          (result.Items ?? []).map(async (raw: any) => {
            let imageLink = raw.imageLink;
            if (!imageLink && raw.nsn) {
              imageLink = await resolveS3ImageLink(raw.teamId, raw.nsn);
            }
            return { ...raw, imageLink };
          })
        );

        return { success: true, items };
      } catch (err: any) {
        console.error(`❌ getItems error:`, err);
        return { success: false, error: err.message };
      }
    }),

  /** GET ITEM **/
  getItem: publicProcedure
    .input(z.object({ teamId: z.string(), itemId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      console.log(`[getItem] Fetching item ${input.itemId} in ${input.teamId}`);
      try {
        const result = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${input.itemId}` },
          })
        );

        if (!result.Item) {
          console.warn(`[getItem] ❌ Item not found`);
          return { success: false, error: "Item not found" };
        }

        let imageLink = result.Item.imageLink;
        if (!imageLink && result.Item.nsn)
          imageLink = await resolveS3ImageLink(result.Item.teamId, result.Item.nsn);

        return { success: true, item: { ...result.Item, imageLink } };
      } catch (err: any) {
        console.error(`❌ getItem error:`, err);
        return { success: false, error: err.message };
      }
    }),

  /** UPDATE ITEM **/
  updateItem: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        itemId: z.string(),
        userId: z.string(),
        name: z.string().optional(),
        actualName: z.string().optional(),
        nsn: z.string().optional(),
        serialNumber: z.string().optional(),
        quantity: z.number().optional(),
        description: z.string().optional(),
        imageLink: z.string().optional(),
        status: z.string().optional(),
        damageReports: z.array(z.string()).optional(),
        parent: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const logPrefix = `[updateItem][${input.itemId}]`;
      try {
        console.log(`${logPrefix} ⚙️ Starting update...`);
        console.log(`${logPrefix} Incoming input:`, JSON.stringify(input, null, 2));

        const now = new Date().toISOString();
        const updates: string[] = ["updatedAt = :updatedAt"];
        const values: Record<string, any> = { ":updatedAt": now };
        const names: Record<string, string> = {};

        // NSN duplicate check
        if (input.nsn) {
          console.log(`${logPrefix} 🔍 Checking duplicates for NSN "${input.nsn}"...`);
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
              i.nsn?.trim?.().toLowerCase() === input.nsn?.trim?.().toLowerCase()
          );

          if (duplicate) {
            console.warn(`${logPrefix} ⚠️ Duplicate NSN detected:`, duplicate);
            return {
              success: false,
              error: `Another item with NSN "${input.nsn}" already exists.`,
            };
          }

          updates.push("nsn = :nsn");
          values[":nsn"] = input.nsn;
        }

        const pushUpdate = (key: string, val: any, fieldName?: string) => {
          if (val !== undefined) {
            updates.push(`${fieldName || key} = :${key}`);
            values[`:${key}`] = val;
            if (key === "name" || key === "status") names[`#${key}`] = key;
            console.log(`${logPrefix} ✅ Queued "${key}" ->`, val);
          }
        };

        pushUpdate("name", input.name, "#name");
        pushUpdate("actualName", input.actualName);
        pushUpdate("serialNumber", input.serialNumber);
        pushUpdate("quantity", input.quantity);
        pushUpdate("description", input.description);
        pushUpdate("imageLink", input.imageLink);
        pushUpdate("status", input.status, "#status");
        pushUpdate("damageReports", input.damageReports);
        pushUpdate("parent", input.parent);
        pushUpdate("notes", input.notes);

        updates.push(
          "updateLog = list_append(if_not_exists(updateLog, :empty), :log)"
        );
        values[":log"] = [
          { userId: input.userId, action: "update", timestamp: now },
        ];
        values[":empty"] = [];

        console.log(`${logPrefix} 🧩 UpdateExpression:`, updates.join(", "));
        console.log(`${logPrefix} 🧾 Values:`, JSON.stringify(values, null, 2));

        const result = await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${input.itemId}` },
            UpdateExpression: `SET ${updates.join(", ")}`,
            ExpressionAttributeValues: values,
            ExpressionAttributeNames:
              Object.keys(names).length > 0 ? names : undefined,
            ReturnValues: "ALL_NEW",
          })
        );

        console.log(`${logPrefix} ✅ Update succeeded:`, result.Attributes);
        return { success: true, item: result.Attributes };
      } catch (err: any) {
        console.error(`${logPrefix} ❌ updateItem error:`, err);
        if (err.$metadata) console.error(`${logPrefix} Dynamo metadata:`, err.$metadata);
        return { success: false, error: err.message };
      }
    }),
});

export type ItemsRouter = typeof itemsRouter;
