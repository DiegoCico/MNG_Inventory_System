import { z } from "zod";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { router, publicProcedure } from "./trpc";
import { s3Client } from "../aws";

const REGION = process.env.AWS_REGION || "us-east-1";
//change later to CDK bucket when ready
const BUCKET = process.env.S3_BUCKET || "mnginfra-dev-webbucket12880f5b-i5rl91kynypx";

const PREFIX = {
  item: "items/",
  user: "users/",
} as const;

  const s3 = s3Client;

const UploadInput = z.object({
  dataUrl: z.string(),                       
  category: z.enum(["item", "user"]).optional()  
});

export const s3Router = router({
  uploadImage: publicProcedure
    .input(UploadInput)
    .mutation(async ({ input }) => {
      const raw = decodeURIComponentSafe(input.dataUrl);
      const m = raw.match(/^data:([\w.+/-]+);base64,(.+)$/i);
      if (!m) throw new Error("Invalid data URL (expected data:<image/*>;base64,<data>)");

      const contentType = m[1].toLowerCase();
      if (!contentType.startsWith("image/")) {
        throw new Error(`Invalid content-type: ${contentType}. Expected image/*`);
      }

      // normalize base64 (spaces -> '+', remove whitespace)
      const base64 = m[2].replace(/\s/g, "").replace(/ /g, "+");
      const body = Buffer.from(base64, "base64");

      const category = input.category ?? "item";
      const prefix = PREFIX[category];

      // safe server-generated filename
      const ext = extFromContentType(contentType);
      //  ID to return to client
      const id = randomUUID();   
      // S3 key (NOT returned to client)                  
      const key = `${prefix}${id}.${ext}`;           

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));

      // don’t leak the key; return opaque id and category
      return {
        ok: true,
        id,                 
        category,            
        bytes: body.length,
      };
    }),
});


function decodeURIComponentSafe(s: string) { try { return decodeURIComponent(s); } catch { return s; } }
function extFromContentType(ct: string) {
  if (ct === "image/png") return "png";
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  return (ct.split("/")[1] || "bin").toLowerCase();
}