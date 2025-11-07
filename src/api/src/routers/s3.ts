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

/* ============================================================================
   Environment + Client Setup
============================================================================ */
const config = loadConfig();
const REGION = config.REGION;
const BUCKET_NAME = config.BUCKET_NAME;
const KMS_KEY_ARN = config.KMS_KEY_ARN;

const s3 = new S3Client({ region: REGION });

if (!BUCKET_NAME) throw new Error("❌ Missing S3_BUCKET_NAME");
if (!KMS_KEY_ARN) console.warn("⚠️ No KMS key ARN provided — uploads not encrypted");

/* ============================================================================
   Utility: Parse Data URL → Buffer
============================================================================ */
function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Invalid data URL format");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { mime, buffer };
}

/* ============================================================================
   TRPC Router
============================================================================ */
export const s3Router = router({
  /* ============================================================
     Upload Profile Image (KMS encrypted)
  ============================================================ */
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

      const putParams: PutObjectCommandInput = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mime,
        ...(KMS_KEY_ARN
          ? {
              ServerSideEncryption: "aws:kms",
              SSEKMSKeyId: KMS_KEY_ARN,
            }
          : {}),
      };

      console.log(`[S3] Uploading ${key} (${buffer.byteLength} bytes)`);

      await s3.send(new PutObjectCommand(putParams));

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
        { expiresIn: 3600 }
      );

      console.log(`[S3] ✅ Uploaded & signed URL generated for ${key}`);
      return { key, url };
    }),

  /* ============================================================
     Get Profile Image (Signed URL)
  ============================================================ */
  getProfileImage: publicProcedure
    .input(z.object({ userId: z.string().min(3) }))
    .query(async ({ input }) => {
      const prefix = `Profile/${input.userId}`;
      const exts = ["jpg", "jpeg", "png", "webp", "heic"];
      let foundUrl: string | null = null;

      for (const ext of exts) {
        const key = `${prefix}.${ext}`;
        try {
          await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
          foundUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
            { expiresIn: 3600 }
          );
          console.log(`[S3] Found profile image for ${input.userId}: ${key}`);
          break;
        } catch {
          continue;
        }
      }

      if (!foundUrl) console.log(`[S3] No profile image found for ${input.userId}`);
      return foundUrl ? { url: foundUrl } : { url: null };
    }),
});

export type S3Router = typeof s3Router;
