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
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import { doc } from "../aws";
import { loadConfig } from "../process";

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;
const BUCKET_NAME = config.BUCKET_NAME;
const REGION = config.REGION;

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

async function hasPermission(
  userId: string,
  teamId: string,
  permission: string
): Promise<boolean> {
  try {
    const res = await doc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `TEAM#${teamId}`, SK: `MEMBER#${userId}` },
      })
    );

    const member = res.Item as { roleId?: string; role?: string } | undefined;
    if (!member) return false;

    if (member.role?.toLowerCase() === "owner") return true;

    if (!member.roleId) return false;
    const roleRes = await doc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ROLE#${member.roleId}`, SK: "METADATA" },
      })
    );

    const role = roleRes.Item as { permissions?: string[] } | undefined;
    if (!role?.permissions) return false;
    return role.permissions.includes(permission);
  } catch (err) {
    console.error("❌ hasPermission error:", err);
    return false;
  }
}

async function resolveS3ImageLink(
  teamId: string,
  nsn: string
): Promise<string | undefined> {
  const exts = ["png", "jpg", "jpeg", "heic"];
  for (const ext of exts) {
    const key = `items/${teamId}/${nsn}.${ext}`;
    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );
      return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
    } catch {
      continue;
    }
  }
  return undefined;
}

export const itemsRouter = router({
  /** CREATE ITEM */
  createItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        actualName: z.string().optional(),
        nsn: z.string().optional(),
        serialNumber: z.string().optional(),
        quantity: z.number().default(1),
        userId: z.string().min(1),
        imageBase64: z.string().optional(),
        damageReports: z.array(z.string()).optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const itemId = newId(12);
        const now = new Date().toISOString();
        let imageLink: string | undefined = undefined;

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
              ACL: "private",
            })
          );

          imageLink = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
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
          status: input.status || 'Incomplete',
          createdAt: now,
          updatedAt: now,
          createdBy: input.userId,
          updateLog: [
            {
              userId: input.userId,
              action: "create",
              timestamp: now,
            },
          ],
        };

        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
        return { success: true, itemId, item };
      } catch (err: any) {
        console.error("❌ createItem error:", err);
        return { success: false, error: err.message || "Failed to create item." };
      }
    }),

  /** GET ALL ITEMS IN TEAM */
  getItems: publicProcedure
    .input(z.object({ teamId: z.string().min(1), userId: z.string().min(1) }))
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
          (result.Items ?? []).map(async (item) => {
            let imageLink = item.imageLink;
            if (!imageLink && item.nsn) {
              imageLink = await resolveS3ImageLink(item.teamId, item.nsn);
            }
            return { ...item, imageLink };
          })
        );

        return { success: true, items };
      } catch (err: any) {
        console.error("❌ getItems error:", err);
        return { success: false, error: err.message || "Failed to fetch items." };
      }
    }),

  /** GET SINGLE ITEM */
  getItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        itemId: z.string().min(1),
        userId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${input.itemId}` },
          })
        );

        if (!result.Item) return { success: false, error: "Item not found." };

        const item = result.Item;
        let imageLink = item.imageLink;
        if (!imageLink && item.nsn) {
          imageLink = await resolveS3ImageLink(item.teamId, item.nsn);
        }

        return { success: true, item: { ...item, imageLink } };
      } catch (err: any) {
        console.error("❌ getItem error:", err);
        return { success: false, error: err.message || "Failed to fetch item." };
      }
    }),

  /** UPDATE ITEM */
  updateItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        itemId: z.string().min(1),
        userId: z.string().min(1),
        name: z.string().optional(),
        actualName: z.string().optional(),
        nsn: z.string().optional(),
        serialNumber: z.string().optional(),
        quantity: z.number().optional(),
        description: z.string().optional(),
        imageLink: z.string().optional(),
        status: z.string().optional(),
        damageReports: z.array(z.string()).optional(),
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

        updates.push(
          "updateLog = list_append(if_not_exists(updateLog, :empty_list), :logEntry)"
        );
        values[":logEntry"] = [
          { userId: input.userId, action: "update", timestamp: now },
        ];
        values[":empty_list"] = [];

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

        return { success: true, item: result.Attributes };
      } catch (err: any) {
        console.error("❌ updateItem error:", err);
        return { success: false, error: err.message || "Failed to update item." };
      }
    }),

  /** DELETE ITEM */
  deleteItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        itemId: z.string().min(1),
        userId: z.string().min(1),
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

        return { success: true, deleted: input.itemId };
      } catch (err: any) {
        console.error("❌ deleteItem error:", err);
        return { success: false, error: err.message || "Failed to delete item." };
      }
    }),
});


