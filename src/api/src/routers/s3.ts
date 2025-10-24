// File: src/api/src/routers/s3.ts
// s3 router (images folded in). Private-by-default uploads, presigned access.
// Uses Zod + tRPC, AWS SDK v3. Keys are stable for DB joins.

import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/* ------------------------- Local Context Typing ------------------------- */

type ImageRepo = {
  save?: (row: {
    id?: string;
    teamId: string;
    scope: "item" | "team" | "report";
    itemId?: string;
    serialNumber?: string;
    key: string;
    contentType: string;
    alt?: string;
    bytes: number;
    createdAt: string;
  }) => Promise<any>;
  removeByKey?: (key: string) => Promise<any>;
};

type AppLogger = { warn?: (meta: any, msg?: string) => void };
type S3Ctx = { repos?: { images?: ImageRepo }; logger?: AppLogger };
type ProcArgs<T> = { input: T; ctx: S3Ctx };

/* ------------------------- Env / Client ------------------------- */

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const s3 = new S3Client({ region: REGION });

// Defer S3 bucket presence check until runtime (prevents import-time crashes in tests)
function requireBucket(): string {
  const bucket =
    process.env.S3_BUCKET ||
    // allow tests to run without env var
    (process.env.NODE_ENV === "test" ? "unit-test-bucket" : "");
  if (!bucket) throw new Error("S3_BUCKET env var is required");
  return bucket;
}

/* ------------------------- Schemas ------------------------- */

const Scope = z.enum(["item", "team", "report"]);

export const UploadInput = z.object({
  scope: Scope,
  teamId: z.string().min(1, "teamId is required"),
  serialNumber: z.string().optional(),
  itemId: z.string().optional(),
  filenameHint: z.string().optional(),
  dataUrl: z.string().url().or(z.string().startsWith("data:")).describe("RFC2397 data URL"),
  alt: z.string().max(200).optional(),
});

const GetUrlInput = z.object({
  key: z.string().min(3),
  expiresIn: z.number().int().positive().max(3600).default(600),
});

const DeleteInput = z.object({ key: z.string().min(3) });

const ListInput = z.object({
  scope: Scope,
  teamId: z.string(),
  serialNumber: z.string().optional(),
  itemId: z.string().optional(),
  limit: z.number().int().positive().max(1000).default(50),
  cursor: z.string().optional(), // S3 ContinuationToken
});

/* ------------------------- Utils ------------------------- */

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

const isAllowedMime = (m: string) => Object.prototype.hasOwnProperty.call(MIME_TO_EXT, m);
const extFromMime = (m: string) => MIME_TO_EXT[m] ?? "";

const sanitizeFilename = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const decodeURIComponentSafe = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const raw = decodeURIComponentSafe(dataUrl);
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(raw);
  if (!m) throw new Error("Invalid data URL (expected data:<mime>;base64,<data>)");
  const mime = m[1].toLowerCase();
  if (!isAllowedMime(mime)) throw new Error(`Unsupported mime: ${mime}`);
  const buffer = Buffer.from(m[2].replace(/\s/g, "").replace(/ /g, "+"), "base64");
  if (!buffer.byteLength) throw new Error("Empty image payload");
  return { mime, buffer };
}

const datePath = () => {
  const [y, m, d] = new Date().toISOString().slice(0, 10).split("-");
  return `${y}/${m}/${d}`;
};

function prefixFor(args: z.infer<typeof UploadInput>): string {
  const parts = ["teams", sanitizeFilename(args.teamId), args.scope];
  if (args.scope === "item") {
    const itemPart = args.itemId
      ? `item-${sanitizeFilename(args.itemId)}`
      : args.serialNumber
      ? `serial-${sanitizeFilename(args.serialNumber)}`
      : "item-unknown";
    parts.push("items", itemPart);
  } else if (args.scope === "report") {
    parts.push("reports");
  }
  return parts.join("/");
}

const stripExt = (name: string) => name.replace(/\.[a-z0-9]+$/i, "");

// s3://<bucket>/teams/<teamId>/<scope>/[items/item-...|serial-...|reports]/YYYY/MM/DD/<uuid>_<hint>.<ext>
function buildKey(args: z.infer<typeof UploadInput>, mime: string): string {
  const id = randomUUID();
  const baseHint = args.filenameHint ?? args.itemId ?? args.serialNumber ?? "image";
  const hint = sanitizeFilename(stripExt(baseHint));   // <-- strip extension here
  return `${prefixFor(args)}/${datePath()}/${id}_${hint}${extFromMime(mime)}`;
}

async function headObjectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: requireBucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------- Router ------------------------- */

export const s3Router = router({
  s3health: publicProcedure.query(() => ({ ok: true, scope: "s3" })),

  uploadImage: publicProcedure
    .input(UploadInput)
    .mutation(async (opts) => {
      const { input, ctx } = opts as ProcArgs<z.infer<typeof UploadInput>>;
      const BUCKET = requireBucket();

      const { mime, buffer } = parseDataUrl(input.dataUrl);
      const Key = buildKey(input, mime);

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key,
          Body: buffer,
          ContentType: mime,
          Metadata: {
            alt: input.alt ?? "",
            teamId: input.teamId,
            scope: input.scope,
            itemId: input.itemId ?? "",
            serialNumber: input.serialNumber ?? "",
          },
        })
      );

      const { repos, logger } = ctx ?? {};
      try {
        await repos?.images?.save?.({
          teamId: input.teamId,
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
        s3,
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

      const exists = await headObjectExists(input.key);
      if (!exists) throw new Error("Object not found");

      const url = await getSignedUrl(
        s3,
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

  listImages: publicProcedure
    .input(ListInput)
    .query(async (opts) => {
      const { input } = opts as ProcArgs<z.infer<typeof ListInput>>;
      const BUCKET = requireBucket();

      const basePrefix = prefixFor({
        scope: input.scope,
        teamId: input.teamId,
        itemId: input.itemId,
        serialNumber: input.serialNumber,
        filenameHint: undefined,
        dataUrl: "data:image/png;base64,x", // satisfies type; unused
        alt: undefined,
      } as z.infer<typeof UploadInput>);

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
});

export type S3Router = typeof s3Router;

/* ------------------------- Testable helpers ------------------------- */
export const __testables = { parseDataUrl, buildKey, extFromMime, sanitizeFilename };