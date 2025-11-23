import { z } from 'zod';
import { router, publicProcedure, permissionedProcedure, protectedProcedure } from './trpc';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { doc } from '../aws';
import { loadConfig } from '../process';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;
const BUCKET_NAME = config.BUCKET_NAME;
const REGION = config.REGION;
const KMS_KEY_ARN = config.KMS_KEY_ARN;

if (!BUCKET_NAME) throw new Error('❌ Missing S3 bucket name');
const s3 = new S3Client({ region: REGION });

/* =========================== HELPERS =========================== */
function newId(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString('base64')
    .replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] as string);
}

function getImageExtension(base64: string): string {
  const m = base64.match(/^data:image\/(\w+);base64,/);
  return m ? m[1].toLowerCase() : 'png';
}

function stripBase64Header(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, '');
}

async function getUserName(userId: string): Promise<string | undefined> {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    }),
  );

  return res.Item?.name;
}

async function getPresignedUrl(imageKey?: string): Promise<string | undefined> {
  if (!imageKey) return undefined;

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey,
    }),
    { expiresIn: 3600 },
  );

  return url;
}

/* =========================== ROUTER =========================== */
export const itemsRouter = router({
  /** CREATE ITEM **/
  createItem: permissionedProcedure('item.create')
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
        damageReports: z.array(z.string()).optional().nullable(),
        status: z.string().optional().nullable(),
        parent: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const existing = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `TEAM#${input.teamId}`,
              ':sk': 'ITEM#',
            },
          }),
        );

        const duplicate = (existing.Items ?? []).find(
          (it: any) => it.nsn?.trim().toLowerCase() === input.nsn.trim().toLowerCase(),
        );

        if (duplicate) {
          return {
            success: false,
            error: `An item with NSN "${input.nsn}" already exists.`,
          };
        }

        const itemId = newId(12);
        const now = new Date().toISOString();

        let imageKey: string | undefined;

        if (input.imageBase64) {
          const ext = getImageExtension(input.imageBase64);
          imageKey = `items/${input.teamId}/${input.nsn}.${ext}`;

          const body = Buffer.from(stripBase64Header(input.imageBase64), 'base64');

          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: imageKey,
              Body: body,
              ContentEncoding: 'base64',
              ContentType: `image/${ext}`,
              ...(KMS_KEY_ARN ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: KMS_KEY_ARN } : {}),
            }),
          );
        }

        const userName = await getUserName(input.userId);

        const item = {
          PK: `TEAM#${input.teamId}`,
          SK: `ITEM#${itemId}`,
          Type: 'Item',
          teamId: input.teamId,
          itemId,
          name: input.name,
          actualName: input.actualName ?? undefined,
          nsn: input.nsn,
          serialNumber: input.serialNumber ?? undefined,
          quantity: input.quantity ?? 1,
          description: input.description ?? undefined,
          imageKey,
          damageReports: input.damageReports ?? [],
          status: input.status ?? 'To Review',
          parent: input.parent ?? null,
          createdAt: now,
          updatedAt: now,
          createdBy: input.userId,
          updateLog: [
            {
              userId: input.userId,
              userName: userName ?? 'Unknown',
              action: 'create',
              timestamp: now,
            },
          ],
        };

        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
        return { success: true, itemId, item };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  getItems: permissionedProcedure('item.view')
    .input(z.object({ teamId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `TEAM#${input.teamId}`,
              ':sk': 'ITEM#',
            },
          }),
        );

        const rawItems = result.Items ?? [];

        const items = await Promise.all(
        rawItems.map(async (raw: any) => {
          const signed = await getPresignedUrl(raw.imageKey);

          let parentName: string | null = null;

          if (raw.parent) {
            const parentRes = await doc.send(
              new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${raw.parent}` },
              }),
            );
            parentName = parentRes.Item?.name ?? null;
          }

          return { ...raw, imageLink: signed, parentName };
        }),
      );


        return { success: true, items };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  getItem: permissionedProcedure('item.view')
    .input(
      z.object({
        teamId: z.string(),
        itemId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: `TEAM#${input.teamId}`,
              SK: `ITEM#${input.itemId}`,
            },
          }),
        );

        if (!result.Item) return { success: false, error: 'Item not found' };

        const signed = await getPresignedUrl(result.Item.imageKey);

        return {
          success: true,
          item: { ...result.Item, imageLink: signed },
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  updateItem: permissionedProcedure('item.update')
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
        imageBase64: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        damageReports: z.array(z.string()).optional().nullable(),
        parent: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const now = new Date().toISOString();

        const updates: string[] = ['updatedAt = :updatedAt'];
        const values: Record<string, any> = { ':updatedAt': now };
        const names: Record<string, string> = {};

        const push = (key: string, val: any, fieldName?: string) => {
          if (val !== undefined && val !== null) {
            updates.push(`${fieldName || key} = :${key}`);
            values[`:${key}`] = val;
            if (key === 'name' || key === 'status') names[`#${key}`] = key;
          }
        };

        // NEW IMAGE UPLOAD
        if (input.imageBase64) {
          const ext = getImageExtension(input.imageBase64);
          const newKey = `items/${input.teamId}/${input.nsn ?? input.itemId}.${ext}`;

          const body = Buffer.from(stripBase64Header(input.imageBase64), 'base64');

          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: newKey,
              Body: body,
              ContentEncoding: 'base64',
              ContentType: `image/${ext}`,
              ...(KMS_KEY_ARN ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: KMS_KEY_ARN } : {}),
            }),
          );

          updates.push('imageKey = :imageKey');
          values[':imageKey'] = newKey;
        }

        push('name', input.name, '#name');
        push('actualName', input.actualName);
        push('serialNumber', input.serialNumber);
        push('quantity', input.quantity);
        push('description', input.description);
        push('status', input.status, '#status');
        push('damageReports', input.damageReports);
        push('parent', input.parent);
        push('notes', input.notes);

        updates.push('updateLog = list_append(if_not_exists(updateLog, :empty), :log)');
        const userName = await getUserName(input.userId);
        values[':log'] = [
          {
            userId: input.userId,
            userName: userName ?? 'Unknown',
            action: 'update',
            timestamp: now,
          },
        ];
        values[':empty'] = [];

        const result = await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${input.itemId}` },
            UpdateExpression: `SET ${updates.join(', ')}`,
            ExpressionAttributeValues: values,
            ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
            ReturnValues: 'ALL_NEW',
          }),
        );

        const attrs = result.Attributes;
        let parentName: string | null = null;
        const signed = await getPresignedUrl(attrs?.imageKey);

        if (attrs?.parent) {
          const parentRes = await doc.send(
            new GetCommand({
              TableName: TABLE_NAME,
              Key: {
                PK: `TEAM#${input.teamId}`,
                SK: `ITEM#${attrs.parent}`,
              },
            }),
          );

          parentName = parentRes.Item?.name ?? null;
        }

        return {
          success: true,
          item: {
            ...result.Attributes,
            imageLink: signed,
            parentName,
          },
        };

      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  deleteItem: permissionedProcedure('item.delete')
    .input(
      z.object({
        teamId: z.string(),
        itemId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const key = {
          PK: `TEAM#${input.teamId}`,
          SK: `ITEM#${input.itemId}`,
        };

        const getRes = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: key,
          }),
        );

        if (!getRes.Item) return { success: false, error: 'Item not found' };

        if (getRes.Item.imageKey) {
          await s3.send(
            new (await import('@aws-sdk/client-s3')).DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: getRes.Item.imageKey,
            }),
          );
        }

        await doc.send(
          new (await import('@aws-sdk/lib-dynamodb')).DeleteCommand({
            TableName: TABLE_NAME,
            Key: key,
          }),
        );

        return { success: true, message: 'Item deleted successfully' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),
  uploadImage: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        nsn: z.string(),
        imageBase64: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const ext = getImageExtension(input.imageBase64);
        const key = `items/${input.teamId}/${input.nsn}.${ext}`;

        const body = Buffer.from(stripBase64Header(input.imageBase64), 'base64');

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: body,
            ContentEncoding: 'base64',
            ContentType: `image/${ext}`,
            ...(KMS_KEY_ARN ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: KMS_KEY_ARN } : {}),
          }),
        );

        return { success: true, imageKey: key };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),
});

export type ItemsRouter = typeof itemsRouter;
