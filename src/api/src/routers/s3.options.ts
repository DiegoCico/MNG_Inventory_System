import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { router, publicProcedure } from "./trpc";

const REGION = process.env.AWS_REGION || "us-east-1";
// temp bucket for practice; swap to CDK bucket when ready
const BUCKET = process.env.S3_BUCKET || "mnginfra-dev-webbucket12880f5b-i5rl91kynypx";
const FOLDER_PREFIX = "images/";

const s3 = new S3Client({ region: REGION });

// data URL schema (accepts large strings)
const UploadInput = z.object({
  key: z.string().min(1),                
  dataUrl: z.string(),           
  cacheControl: z.string().optional(),
});

export const s3Router = router({
  uploadImage: publicProcedure
    .input(UploadInput)
    .mutation(async ({ input }) => {
      const raw = decodeURIComponentSafe(input.dataUrl);

      // Parse: data:image/png;base64,AAA...
      const m = raw.match(/^data:([\w.+/-]+);base64,(.+)$/i);
      if (!m) throw new Error("Invalid data URL (expected data:<image/*>;base64,<data>)");

      const contentType = m[1];
      if (!contentType.toLowerCase().startsWith("image/")) {
        throw new Error(`Invalid content-type: ${contentType}. Expected image/*`);
      }

      const base64 = m[2].replace(/\s/g, "").replace(/ /g, "+");
      const bytes = Buffer.from(base64, "base64");

      const key = `${FOLDER_PREFIX}${sanitizeKey(input.key)}`;

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: input.cacheControl ?? undefined, 
      }));

      return {
        ok: true,
        bucket: BUCKET,
        key,
        contentType,
        region: REGION,
        bytes: bytes.length,
      };
    }),
});

// helpers 
function sanitizeKey(name: string) {
  // strip leading slashes, collapse paths, and remove illegal S3 chars we don’t want
  return name.replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "").replace(/[\r\n]/g, "");
}

function decodeURIComponentSafe(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}