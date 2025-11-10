import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadConfig } from "../process";

const config = loadConfig();
const REGION = config.REGION;
const BUCKET_NAME = config.BUCKET_NAME;
const KMS_KEY_ARN = config.KMS_KEY_ARN;

const s3 = new S3Client({ region: REGION });

if (!BUCKET_NAME) throw new Error("❌ Missing S3_BUCKET_NAME");
if (!KMS_KEY_ARN) console.warn("⚠️ No KMS key ARN provided — uploads not encrypted");

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Invalid data URL format");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { mime, buffer };
}

export const s3Router = router({
  uploadProfileImage: publicProcedure
    .input(
      z.object({
        userId: z.string().min(3),
        dataUrl: z.string().startsWith("data:"),
      })
    )
    .mutation(async ({ input }) => {
      const { mime, buffer } = parseDataUrl(input.dataUrl);
      const ext = mime.split("/")[1] || "jpg";
      const key = `Profile/${input.userId}.${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key,
          Body: buffer,
          ContentType: mime,
          Metadata: {
            alt: input.alt ?? "",
            teamId,
            scope: input.scope,
            itemId: input.itemId ?? "",
            serialNumber: input.serialNumber ?? "",
          },
        })
      );

      const { repos, logger } = ctx ?? {};
      try {
        await repos?.images?.save?.({
          teamId,
          scope: input.scope,
          itemId: input.itemId,
          serialNumber: input.serialNumber,
          key: Key,
          contentType: mime,
          alt: input.alt,
          bytes: buffer.byteLength,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        logger?.warn?.({ err: e, where: "s3.uploadImage.db" }, "Image metadata save failed");
      }

      const headUrl = await getSignedUrl(
        s3 as unknown as any, // guard against AWS v3 minor skew in types
        new HeadObjectCommand({ Bucket: BUCKET, Key }),
        { expiresIn: 60 }
      );

      return { key: Key, contentType: mime, size: buffer.byteLength, headUrl };
    }),

  getSignedUrl: publicProcedure
    .input(GetUrlInput)
    .query(async (opts) => {
      const { input } = opts as ProcArgs<z.infer<typeof GetUrlInput>>;
      const BUCKET = requireBucket();

      const exists = await headObjectExists(BUCKET, input.key);
      if (!exists) throw new Error("Object not found");

      // Generate a presigned URL for GET (download/view)
      const url = await getSignedUrl(
        s3 as unknown as any,
        new HeadObjectCommand({ Bucket: BUCKET, Key: input.key }),
        { expiresIn: input.expiresIn }
      );
      return { url };
    }),

  deleteObject: publicProcedure
    .input(DeleteInput)
    .mutation(async (opts) => {
      const { input, ctx } = opts as ProcArgs<z.infer<typeof DeleteInput>>;
      const BUCKET = requireBucket();

      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: input.key }));
      try {
        await ctx?.repos?.images?.removeByKey?.(input.key);
      } catch {
        /* ignore */
      }
      return { ok: true };
    }),

  // FRONTEND INPUT NOW: { scope, serialNumber?, itemId?, limit?, cursor? }
  // - teamId derived from ctx
  listImages: publicProcedure
    .input(ListInput)
    .query(async (opts) => {
      const { input, ctx } = opts as ProcArgs<z.infer<typeof ListInput>>;
      const BUCKET = requireBucket();
      const teamId = getTeamId(ctx);

      const basePrefix = prefixFor(teamId, {
        scope: input.scope,
        itemId: input.itemId,
        serialNumber: input.serialNumber,
      });

      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: basePrefix,
          ContinuationToken: input.cursor,
          MaxKeys: input.limit,
        })
      );

      return {
        items: (resp.Contents ?? []).map((o) => ({
          key: o.Key!,
          size: o.Size ?? 0,
          lastModified: o.LastModified?.toISOString(),
        })),
        nextCursor: resp.NextContinuationToken ?? undefined,
        prefix: basePrefix,
      };
    }),

  getInventoryForm: protectedProcedure
    .input(
      z.object({
        teamId: z.string().optional(),
        nsn: z.string().min(1, "NSN is required"),
      })
    )
    .query(async (opts) => {
      const { input, ctx } = opts as ProcArgs<{ teamId?: string; nsn: string }>;
      const BUCKET = requireBucket();

      // Derive teamId from context or override if provided
      const teamId = input.teamId ?? getTeamId(ctx);

      // S3 key: Documents/:teamId/inventoryForm/:nsn.pdf
      const Key = `Documents/${teamId}/inventoryForm/${input.nsn}.pdf`;

      // Check existence first
      const exists = await headObjectExists(BUCKET, Key);
      if (!exists) throw new Error(`Inventory form for NSN ${input.nsn} not found`);

      // Generate a presigned URL for GET (download/view)
      const url = await getSignedUrl(
        s3 as unknown as any,
        new HeadObjectCommand({ Bucket: BUCKET, Key }),
        { expiresIn: 600 } // 10 min
      );

      return { url, key: Key };
    }),
});

export type S3Router = typeof s3Router;
