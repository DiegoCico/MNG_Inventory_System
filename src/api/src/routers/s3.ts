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

/**
 * ---------------------------------------------------------------------------
 * S3 Router — Unified Image and File Upload Service
 * ---------------------------------------------------------------------------
 * Endpoints
 *   • `s3health` — ping
 *   • `uploadImage` — upload from data URL; server derives teamId and uses serialNumber as filename
 *   • `getSignedUrl` — presigned HEAD URL
 *   • `deleteObject` — delete by key (+ optional DB cleanup)
 *   • `listImages` — list objects under team/scope/item prefix (teamId derived server-side)
 * Behavior
 *   • Objects private by default; presign to access.
 *   • In tests, a dummy bucket is used.
 * ---------------------------------------------------------------------------
 */

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

// Your app likely provides teamId on the context via session/auth.
// We support several common locations; customize if needed.
type S3Ctx = {
  repos?: { images?: ImageRepo };
  logger?: AppLogger;
  teamId?: string;
  user?: { teamId?: string };
  session?: { teamId?: string };
  auth?: { teamId?: string };
};
type ProcArgs<T> = { input: T; ctx: S3Ctx };

/* ------------------------- Env / Client ------------------------- */

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const s3 = new S3Client({ region: REGION });

function requireBucket(): string {
  const bucket =
    process.env.S3_BUCKET ||
    (process.env.NODE_ENV === "test" ? "unit-test-bucket" : "");
  if (!bucket) throw new Error("S3_BUCKET env var is required");
  return bucket;
}

/* ------------------------- Schemas ------------------------- */

const Scope = z.enum(["item", "team", "report"]);

// NOTE: teamId REMOVED (derived from ctx)
// NOTE: filenameHint REMOVED (we use serialNumber as filename)
export const UploadInput = z.object({
  scope: Scope,
  serialNumber: z.string().optional(),
  itemId: z.string().optional(),
  dataUrl: z.string().url().or(z.string().startsWith("data:")).describe("RFC2397 data URL"),
  alt: z.string().max(200).optional(),
});

const GetUrlInput = z.object({
  key: z.string().min(3),
  expiresIn: z.number().int().positive().max(3600).default(600),
});

const DeleteInput = z.object({ key: z.string().min(3) });

// NOTE: teamId REMOVED (derived from ctx)
const ListInput = z.object({
  scope: Scope,
  serialNumber: z.string().optional(),
  itemId: z.string().optional(),
  limit: z.number().int().positive().max(1000).default(50),
  cursor: z.string().optional(),
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

// Pull team id from context in a flexible way (customize as needed for your app)
function getTeamId(ctx: S3Ctx): string {
  const fromCtx =
    ctx?.teamId ??
    ctx?.session?.teamId ??
    ctx?.user?.teamId ??
    ctx?.auth?.teamId;

  // Allow tests to run without wiring a full auth context.
  const fallbackForTests =
    process.env.NODE_ENV === "test"
      ? (process.env.TEST_TEAM_ID ?? "alpha")
      : undefined;

  const teamId = fromCtx ?? fallbackForTests;

  if (!teamId) throw new Error("Missing teamId in server context");
  return sanitizeFilename(teamId);
}

// Build the prefix using explicit teamId
function prefixFor(teamId: string, args: Pick<z.infer<typeof UploadInput>, "scope" | "itemId" | "serialNumber">): string {
  const parts = ["teams", teamId, args.scope];
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

// s3://<bucket>/teams/<teamId>/<scope>/.../YYYY/MM/DD/<uuid>_<hint>.<ext>
// Hint selection: serialNumber (preferred) → itemId → "image"
function buildKey(
  teamId: string,
  args: z.infer<typeof UploadInput>,
  mime: string
): string {
  const id = randomUUID();
  const baseHint = args.serialNumber ?? args.itemId ?? "image";
  const hint = sanitizeFilename(stripExt(baseHint));
  return `${prefixFor(teamId, args)}/${datePath()}/${id}_${hint}${extFromMime(mime)}`;
}

async function headObjectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------- Router ------------------------- */

export const s3Router = router({
  s3health: publicProcedure.query(() => ({ ok: true, scope: "s3" })),

  // FRONTEND INPUT NOW: { scope, serialNumber?, itemId?, dataUrl, alt? }
  // - teamId is derived from ctx
  // - filename uses serialNumber (or itemId) automatically
  uploadImage: publicProcedure
    .input(UploadInput)
    .mutation(async (opts) => {
      const { input, ctx } = opts as ProcArgs<z.infer<typeof UploadInput>>;
      const BUCKET = requireBucket();
      const teamId = getTeamId(ctx);

      const { mime, buffer } = parseDataUrl(input.dataUrl);
      const Key = buildKey(teamId, input, mime);

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
});

export type S3Router = typeof s3Router;

/* ------------------------- Testable helpers ------------------------- */
export const __testables = { parseDataUrl, buildKey, extFromMime, sanitizeFilename };