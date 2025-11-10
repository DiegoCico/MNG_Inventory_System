import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
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

/* =========================== HELPERS =========================== */
function newId(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString("base64")
    .replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c] as string));
}

function getImageExtension(base64: string): string {
  const m = base64.match(/^data:image\/(\w+);base64,/);
  return m ? m[1].toLowerCase() : "png";
}

function stripBase64Header(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, "");
}

/**
 * ✅ Takes an S3 URL and returns a presigned URL that works even with KMS encryption.
 * If it's not an S3 URL, returns it unchanged.
 */
async function getPresignedUrlIfNeeded(imageLink?: string): Promise<string | undefined> {
  if (!imageLink || !imageLink.startsWith("https://")) return imageLink;

  const match = imageLink.match(/amazonaws\.com\/(.+)/);
  if (!match) return imageLink;

  const key = match[1];
  try {
    // Check object exists first
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
      { expiresIn: 3600 }
    );
    return signedUrl;
  } catch (err: any) {
    console.warn("[getPresignedUrlIfNeeded] Could not presign:", err.message);
    return imageLink;
  }
}

/* =========================== ROUTER =========================== */
export const itemsRouter = router({
  /** CREATE ITEM **/
  createItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        name: z.string().min(1),
        userId: z.string().min(1),

        description: z.string().optional().nullable(),
        actualName: z.string().optional().nullable(),
        nsn: z.string().min(1),
        serialNumber: z.string().optional().nullable(),
        quantity: z.number().optional().nullable(),
        imageBase64: z.string().optional().nullable(),
        imageLink: z.string().optional().nullable(),
        damageReports: z.array(z.string()).optional().nullable(),
        status: z.string().optional().nullable(),
        parent: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      console.log(`[createItem] Received:`, JSON.stringify(input, null, 2));
      try {
        // ✅ Prevent duplicate NSNs
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
          (it: any) =>
            it.nsn &&
            it.nsn.trim().toLowerCase() === input.nsn.trim().toLowerCase()
        );
        if (duplicate) {
          return {
            success: false,
            error: `An item with NSN "${input.nsn}" already exists.`,
          };
        }

        const itemId = newId(12);
        const now = new Date().toISOString();

        // ✅ Upload new image if provided
        let finalImageLink = input.imageLink ?? undefined;
        if (!finalImageLink && input.imageBase64 && input.nsn) {
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
                ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: KMS_KEY_ARN }
                : {}),
            })
          );

          // Store the static S3 URL
          finalImageLink = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
        }

        const item = {
          PK: `TEAM#${input.teamId}`,
          SK: `ITEM#${itemId}`,
          Type: "Item",
          teamId: input.teamId,
          itemId,
          name: input.name,
          actualName: input.actualName ?? undefined,
          nsn: input.nsn,
          serialNumber: input.serialNumber ?? undefined,
          quantity: input.quantity ?? 1,
          description: input.description ?? undefined,
          imageLink: finalImageLink,
          damageReports: input.damageReports ?? [],
          status: input.status ?? "To Review",
          parent: input.parent ?? null,
          createdAt: now,
          updatedAt: now,
          createdBy: input.userId,
          updateLog: [{ userId: input.userId, action: "create", timestamp: now }],
        };

        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
        return { success: true, itemId, item };
      } catch (err: any) {
        console.error("❌ createItem error:", err);
        return { success: false, error: err.message };
      }
    }),

  /** GET ITEMS **/
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

        const items = await Promise.all(
          (result.Items ?? []).map(async (raw: any) => {
            const imageLink = await getPresignedUrlIfNeeded(raw.imageLink);
            return { ...raw, imageLink };
          })
        );

        return { success: true, items };
      } catch (err: any) {
        console.error("❌ getItems error:", err);
        return { success: false, error: err.message };
      }
    }),

  /** GET SINGLE ITEM **/
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
        if (!result.Item)
          return { success: false, error: "Item not found" };

        const presigned = await getPresignedUrlIfNeeded(result.Item.imageLink);

        return { success: true, item: { ...result.Item, imageLink: presigned } };
      } catch (err: any) {
        console.error("❌ getItem error:", err);
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
        name: z.string().optional().nullable(),
        actualName: z.string().optional().nullable(),
        nsn: z.string().optional().nullable(),
        serialNumber: z.string().optional().nullable(),
        quantity: z.number().optional().nullable(),
        description: z.string().optional().nullable(),
        imageLink: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        damageReports: z.array(z.string()).optional().nullable(),
        parent: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const log = (m: string, ...args: any[]) =>
        console.log(`[updateItem][${input.itemId}] ${m}`, ...args);
      try {
        const now = new Date().toISOString();
        const updates: string[] = ["updatedAt = :updatedAt"];
        const values: Record<string, any> = { ":updatedAt": now };
        const names: Record<string, string> = {};

        if (input.nsn) {
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
          if (duplicate)
            return {
              success: false,
              error: `Another item with NSN "${input.nsn}" already exists.`,
            };
          updates.push("nsn = :nsn");
          values[":nsn"] = input.nsn;
        }

        const push = (key: string, val: any, fieldName?: string) => {
          if (val !== undefined && val !== null) {
            updates.push(`${fieldName || key} = :${key}`);
            values[`:${key}`] = val;
            if (key === "name" || key === "status") names[`#${key}`] = key;
          }
        };

        push("name", input.name, "#name");
        push("actualName", input.actualName);
        push("serialNumber", input.serialNumber);
        push("quantity", input.quantity);
        push("description", input.description);
        push("imageLink", input.imageLink);
        push("status", input.status, "#status");
        push("damageReports", input.damageReports);
        push("parent", input.parent);
        push("notes", input.notes);

        updates.push(
          "updateLog = list_append(if_not_exists(updateLog, :empty), :log)"
        );
        values[":log"] = [
          { userId: input.userId, action: "update", timestamp: now },
        ];
        values[":empty"] = [];

        log("UpdateExpression:", updates.join(", "));
        const result = await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${input.itemId}` },
            UpdateExpression: `SET ${updates.join(", ")}`,
            ExpressionAttributeValues: values,
            ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
            ReturnValues: "ALL_NEW",
          })
        );

        log("✅ Update succeeded");
        return { success: true, item: result.Attributes };
      } catch (err: any) {
        console.error(`[updateItem][${input.itemId}] ❌`, err);
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
        console.log("[uploadImage] start", input.nsn);
        const extMatch = input.imageBase64.match(/^data:image\/(\w+);base64,/);
        const ext = extMatch ? extMatch[1].toLowerCase() : "png";
        const body = Buffer.from(
          input.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
          "base64"
        );
        const key = `items/${input.teamId}/${input.nsn}.${ext}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: body,
            ContentEncoding: "base64",
            ContentType: `image/${ext}`,
            ...(KMS_KEY_ARN
              ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: KMS_KEY_ARN }
              : {}),
          })
        );

        const imageLink = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
        console.log("[uploadImage] uploaded:", imageLink);
        return { success: true, imageLink };
      } catch (err: any) {
        console.error("[uploadImage] ❌", err);
        return { success: false, error: err.message };
      }
    }),
});

export type ItemsRouter = typeof itemsRouter;
