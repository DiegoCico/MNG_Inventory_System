/**
 * Item Profiles Router
 * ============================================================================
 * Purpose
 * ----------------------------------------------------------------------------
 * Server-side tRPC router for managing **Item Profiles**. An Item Profile is a
 * per-workspace (team) record that describes an inventory item and includes:
 *   - `nsn` (required): National Stock Number (or org-specific catalog #)
 *   - `name` (required)
 *   - `description` (optional)
 *   - `imageKey` (optional): S3 key for the item's image
 *   - `parentItemId` (optional): hierarchical parent (same team)
 *   - `lastKnownLocation` (optional)
 * The router enforces auth, workspace scoping, S3 image validation, and
 * DynamoDB-backed CRUD with pagination and filtering.
 *
 * How this router is mounted
 * ----------------------------------------------------------------------------
 *   import { itemProfilesRouter } from "./itemProfiles";
 *   export const appRouter = router({
 *     itemProfiles: itemProfilesRouter,
 *     // ...
 *   });
 *
 * How callers authenticate & scope requests
 * ----------------------------------------------------------------------------
 * - **User**: `x-user-id` header is required. Missing → `UNAUTHORIZED`.
 * - **Workspace/Team**: resolved from Express route param `:workspaceId`
 *   (preferred), or from legacy header `x-team-id`. Missing → `FORBIDDEN`.
 * - All reads/writes are performed **within** the resolved teamId; cross-team
 *   access is not permitted.
 * - **TEMP (until cookie-based tRPC auth):** each input includes { userId, teamId } supplied by the frontend.
 *
 * Image handling (S3)
 * ----------------------------------------------------------------------------
 * - `imageKey` must be under the team prefix: `teams/{teamId}/...`.
 * - On create/update, we perform an S3 `HeadObject` for the key to ensure the
 *   object already exists (the upload is handled by the dedicated S3 router).
 * - If `imageKey` is provided and does not exist or has the wrong prefix,
 *   the request fails with `BAD_REQUEST`.
 *
 * Storage layout (DynamoDB)
 * ----------------------------------------------------------------------------
 * Table (env: `DDB_TABLE`) stores records using:
 *   - PK = `TEAM#{teamId}`
 *   - SK = `ITEM#{id}`
 *   - GSI_ItemsByNSN:
 *       * GSI7PK = `TEAM#{teamId}#NSN`
 *       * GSI7SK = `{nsn}`
 *     Used for NSN uniqueness checks and direct lookup by NSN within a team.
 *   - GSI_ItemsByParent:
 *       * GSI2PK = `TEAM#{teamId}#PARENT#{parentItemId|ROOT}`
 *       * GSI2SK = `{updatedAt ISO}`
 *     Used to list children of a parent item quickly.
 *
 * Runtime configuration (environment with safe defaults)
 * - `DDB_TABLE`: DynamoDB table name (defaults to "mng-dev-data")
 * - `S3_BUCKET`: S3 bucket for item images (defaults to "mngweb-dev-webbucket12880f5b-kq75xxdqbbvj")
 * - `AWS_REGION`: region (defaults to "us-east-1")
Router no longer throws on missing env; local defaults are applied for dev.*
 * Typical usage (tRPC client)
 * ----------------------------------------------------------------------------
 *   // Create
 *   await trpc.itemProfiles.create.mutate({
 *     nsn: "1234-5678-90",
 *     name: "Widget A",
 *     imageKey: "teams/alpha/images/widget-a.jpg",
 *     description: "A standard widget",
 *     lastKnownLocation: "Aisle 5",
 *   });
 *
 *   // Read
 *   const one = await trpc.itemProfiles.getById.query({ id: "..." });
 *   const byNsn = await trpc.itemProfiles.findByNSN.query({ nsn: "1234-5678-90" });
 *
 *   // Update
 *   await trpc.itemProfiles.update.mutate({ id: "...", patch: { name: "New name" } });
 *
 *   // Delete (soft by default; set hard=true for hard-delete)
 *   await trpc.itemProfiles.delete.mutate({ id: "...", hard: false });
 *
 * Error model
 * ----------------------------------------------------------------------------
 * - Known validation/auth conditions throw TRPCError with appropriate codes:
 *   `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`, `NOT_FOUND`.
 * - Unknown errors are mapped to `INTERNAL_SERVER_ERROR` via `mapRepoError`.
 *
 * Notes for contributors
 * ----------------------------------------------------------------------------
 * - Keep header/param resolution aligned with S3/workspace routers.
 * - Avoid in-memory storage; all persistence is through the shared `doc` client.
 * - If you add new query patterns, prefer new GSIs over table scans.
 * - Keep audit stamping (`createdAt/By`, `updatedAt/By`) centralized here.
 */


import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { doc } from "../aws";
import { PutCommand, UpdateCommand, GetCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { s3Client } from "../aws";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

type Ctx = import("./trpc").Context;

/** 
 * Helper function to lookup a header value from the context.
 * Supports both Express-style req.headers and Lambda event.headers.
 * @param ctx - The tRPC context containing req and event objects.
 * @param key - The header key to lookup (case-insensitive).
 * @returns The header string value if found, otherwise undefined.
 */
function headerLookup(ctx: Ctx, key: string): string | undefined {
  const h1 = ctx.req?.headers?.[key.toLowerCase()];
  if (typeof h1 === "string") return h1;
  if (Array.isArray(h1)) return h1[0];
  const h2 = ctx.event?.headers?.[key] ?? ctx.event?.headers?.[key.toLowerCase()];
  if (typeof h2 === "string") return h2;
  return undefined;
}

/**
 * Requires and returns the authenticated user ID from headers.
 * Throws TRPCError(UNAUTHORIZED) if missing.
 * @param ctx - The tRPC context.
 * @returns The user ID string.
 * @throws TRPCError if user ID header is missing.
 */
function requireUserId(ctx: Ctx): string {
  const userId = headerLookup(ctx, "x-user-id");
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing user" });
  return userId;
}

/**
 * Resolve the workspace/team identifier for scoping.
 * Priority:
 *   1) Express route param `:workspaceId`
 *   2) Lambda `event.pathParameters.workspaceId`
 *   3) Legacy header `x-team-id` (backward compatibility)
 * Throws FORBIDDEN if none is provided.
 */
function requireTeamId(ctx: Ctx): string {
  // Express route param: /api/workspaces/:workspaceId/...
  const expressParam = (ctx.req as any)?.params?.workspaceId as string | undefined;
  // API Gateway v2 path param
  const lambdaParam = (ctx.event as any)?.pathParameters?.workspaceId as string | undefined;
  // Legacy header fallback (kept only for backward compat)
  const headerFallback = headerLookup(ctx, "x-team-id");

  const teamId = expressParam || lambdaParam || headerFallback;
  if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Missing team/workspace id" });
  return teamId;
}

/**
 * Validate that the provided S3 key is under the team's namespace.
 * Prevents cross-team key spoofing by enforcing prefix: `teams/{teamId}/`.
 */
function assertValidImageKey(teamId: string, imageKey?: string) {
  if (!imageKey) return;
  const allowedPrefix = `teams/${teamId}/`;
  if (!imageKey.startsWith(allowedPrefix)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `imageKey must start with ${allowedPrefix}` });
  }
}

/** Normalize an S3 key: remove leading slash and trim spaces. */
function normalizeImageKey(key?: string): string | undefined {
  if (!key) return undefined;
  const trimmed = key.trim();
  return trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
}

/**
 * Ensure the referenced S3 object exists in the configured bucket.
 * Also enforces the team prefix validation via `assertValidImageKey`.
 * @throws TRPCError(BAD_REQUEST) if the key is missing or outside the team prefix.
 */
async function ensureImageObjectExists(teamId: string, rawKey?: string): Promise<string | undefined> {
  const imageKey = normalizeImageKey(rawKey);
  if (!imageKey) return undefined;
  assertValidImageKey(teamId, imageKey);
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: imageKey }));
    return imageKey;
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `imageKey does not exist in bucket ${S3_BUCKET}: ${imageKey}`,
    });
  }
}

/** Returns the current timestamp as a Date object. */
function now() { return new Date(); }

/**
 * Creates audit metadata for a newly created record.
 * Sets createdAt, updatedAt to current time and createdBy, updatedBy to userId.
 * Includes the teamId for scoping.
 * @param userId - The ID of the user creating the record.
 * @param teamId - The team ID to scope the record.
 * @returns An object with audit fields for creation.
 */
function makeAuditOnCreate(userId: string, teamId: string) {
  const ts = now();
  return { createdAt: ts, updatedAt: ts, createdBy: userId, updatedBy: userId, teamId };
}

/**
 * Creates audit metadata for an updated record.
 * Sets updatedAt to current time and updatedBy to userId.
 * @param userId - The ID of the user updating the record.
 * @returns An object with audit fields for update.
 */
function makeAuditOnUpdate(userId: string) {
  return { updatedAt: now(), updatedBy: userId };
}

/**
 * Maps errors from the repository layer to TRPCError.
 * If the error already has a code, it is returned as-is.
 * Otherwise, wraps with INTERNAL_SERVER_ERROR and includes the original error as cause.
 * @param e - The unknown error object.
 * @returns A TRPCError instance.
 */
function mapRepoError(e: unknown): TRPCError {
  const maybeCode = (e as any)?.code;
  if (typeof maybeCode === "string") return e as TRPCError;
  const msg = (e as any)?.message ?? "Unexpected error";
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg, cause: e });
}

/** 
 * Zod Schemas for validation and typing.
 */

/** Shared auth input (temporary until cookies-based auth is wired through tRPC) */
const AuthInput = z.object({
  userId: z.string().min(1, "userId required"),
  teamId: z.string().min(1, "teamId required"),
});

/** Helper to pull userId/teamId from inputs (front-end supplies both for now). */
function authFromInput(input: { userId: string; teamId: string }) {
  return { userId: input.userId, teamId: input.teamId };
}

/**
 * Schema for ID strings.
 * Must be a non-empty string.
 */
const IdSchema = z.string().min(1, "required");

/**
 * Base schema for ItemProfile input
 * - `nsn` (required): string; unique per team (enforced via GSI query)
 * - `name` (required): string
 * - `description` (optional): string
 * - `imageKey` (optional): string; S3 object key under `teams/{teamId}/...`
 * - `parentItemId` (optional): string; must point to an item in the same team
 * - `lastKnownLocation` (optional): string
 */
const ItemProfileBase = z.object({
  nsn: z.string().min(1),                     // REQUIRED
  name: z.string().min(1),                    // REQUIRED
  description: z.string().optional(),         // optional
  imageKey: z.string().min(1).optional(),     // optional (S3 object key)
  parentItemId: z.string().min(1).optional(), // optional (points to another item id)
  lastKnownLocation: z.string().optional(),   // optional (freeform)
});

/**
 * Input schema for creating a new Item Profile.
 * Extends ItemProfileBase with optional id (UUID).
 * The id is usually generated server-side if not provided.
 */
const CreateItemProfileInput = ItemProfileBase.extend({
  id: z.string().uuid().optional(),
}).and(AuthInput);

/**
 * Patch schema for updating an Item Profile.
 * All fields are optional and validated similarly to base schema.
 * Empty objects are rejected by refinement.
 */
const ItemProfilePatch = z.object({
  nsn: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  imageKey: z.string().min(1).optional(),
  parentItemId: z.string().min(1).optional(),
  lastKnownLocation: z.string().optional(),
});

/**
 * Input schema for update operation.
 * Requires an id and a non-empty patch object.
 */
const UpdateItemProfileInput = z.object({
  id: IdSchema,
  patch: ItemProfilePatch.refine((p) => p && Object.keys(p).length > 0, {
    message: "patch cannot be empty",
  }),
}).and(AuthInput);

/**
 * Input schema for delete operation.
 * Requires id and optional hard flag indicating hard vs soft delete.
 */
const DeleteItemProfileInput = z.object({
  id: IdSchema,
  hard: z.boolean().default(false),
}).and(AuthInput);

/**
 * Input schema for listing Item Profiles.
 * Supports optional filtering by search query and parentItemId.
 * Includes pagination (limit, cursor) and ordering controls.
 */
const ListItemProfilesInput = z.object({
  q: z.string().trim().optional(),
  parentItemId: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  orderBy: z.enum(["createdAt", "updatedAt", "name"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
}).and(AuthInput);

/**
 * Type representing a full ItemProfile record stored in the repo.
 * Includes all base fields plus id, teamId, audit timestamps, user info, and optional deletedAt.
 */
export type ItemProfileRecord = z.infer<typeof ItemProfileBase> & {
  id: string;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
};

/**
 * Repository: DynamoDB implementation (no in-memory state)
 * ----------------------------------------------------------------------------
 * Keys:
 *   - PK = TEAM#{teamId}
 *   - SK = ITEM#{id}
 * GSIs:
 *   - GSI_ItemsByNSN:
 *       GSI7PK = TEAM#{teamId}#NSN
 *       GSI7SK = {nsn}
 *     Used for uniqueness checks and direct lookup by NSN.
 *   - GSI_ItemsByParent:
 *       GSI2PK = TEAM#{teamId}#PARENT#{parent|ROOT}
 *       GSI2SK = {updatedAt ISO}
 *     Used for listing children by parent item.
 * Notes:
 *   - All date fields are stored as ISO strings.
 *   - `deletedAt` is used for soft delete and excluded by `fromDb`.
 */
// --- Environment with safe defaults (dev-friendly) -------------------------
const DEFAULT_ENV = {
  DDB_TABLE: "mng-dev-data",
  S3_BUCKET: "mngweb-dev-webbucket12880f5b-kq75xxdqbbvj",
  AWS_REGION: "us-east-1",
} as const;

const DDB_TABLE = process.env.DDB_TABLE?.trim() || DEFAULT_ENV.DDB_TABLE;
const S3_BUCKET = process.env.S3_BUCKET?.trim() || DEFAULT_ENV.S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION?.trim() || DEFAULT_ENV.AWS_REGION;

// Dev defaults mirror: DDB_TABLE=mng-dev-data S3_BUCKET=mngweb-dev-webbucket12880f5b-kq75xxdqbbvj AWS_REGION=us-east-1

// --- Index name & key attribute config (env-overridable) --------------------
const INDEX = {
  itemsByNSN: process.env.GSI_ITEMS_BY_NSN?.trim() || "GSI_ItemsByNSN",
  itemsByParent: process.env.GSI_ITEMS_BY_PARENT?.trim() || "GSI_ItemsByParent",
} as const;

// If your table used different attribute names for the index keys, override here via env.
// These are the attribute *names* stored on each item that the GSIs read from.
const GSI_ATTR = {
  nsnPK: process.env.GSI7PK_ATTR?.trim() || "GSI7PK",
  nsnSK: process.env.GSI7SK_ATTR?.trim() || "GSI7SK",
  parentPK: process.env.GSI2PK_ATTR?.trim() || "GSI2PK",
  parentSK: process.env.GSI2SK_ATTR?.trim() || "GSI2SK",
} as const;

// Override GSI names/attributes at runtime by setting env vars, e.g.:
//   GSI_ITEMS_BY_NSN=NewIndexName
//   GSI7PK_ATTR=NEW_PK_ATTR
// This prevents code changes when infra renames indexes/keys.

// --- Key builders (keep in sync with table/CDK) ----------------------------
const pk = (teamId: string) => `TEAM#${teamId}`;
const sk = (id: string) => `ITEM#${id}`;

// GSIs
const gsi7pk = (teamId: string) => `TEAM#${teamId}#NSN`; // uniqueness per team (NSN)
const gsi2pk = (teamId: string, parentItemId?: string) =>
  `TEAM#${teamId}#PARENT#${parentItemId ?? "ROOT"}`;

function toDb(rec: ItemProfileRecord) {
  return {
    PK: pk(rec.teamId),
    SK: sk(rec.id),

    id: rec.id,
    teamId: rec.teamId,
    nsn: rec.nsn,
    name: rec.name,
    description: rec.description ?? null,
    imageKey: rec.imageKey ?? null,
    parentItemId: rec.parentItemId ?? null,
    lastKnownLocation: rec.lastKnownLocation ?? null,

    createdAt: rec.createdAt.toISOString(),
    updatedAt: rec.updatedAt.toISOString(),
    createdBy: rec.createdBy,
    updatedBy: rec.updatedBy,
    deletedAt: rec.deletedAt ? rec.deletedAt.toISOString() : null,

    // GSIs (use env-driven attribute names so schema can change without code edits)
    [GSI_ATTR.nsnPK]: gsi7pk(rec.teamId),                                   // e.g., "GSI7PK"
    [GSI_ATTR.nsnSK]: rec.nsn,                                              // e.g., "GSI7SK"
    [GSI_ATTR.parentPK]: gsi2pk(rec.teamId, rec.parentItemId ?? undefined), // e.g., "GSI2PK"
    [GSI_ATTR.parentSK]: rec.updatedAt.toISOString(),                       // e.g., "GSI2SK"

    entity: "ItemProfile",
  };
}

function fromDb(item: any): ItemProfileRecord | null {
  if (!item || item.deletedAt) return null;
  return {
    id: item.id,
    teamId: item.teamId,
    nsn: item.nsn,
    name: item.name,
    description: item.description ?? undefined,
    imageKey: item.imageKey ?? undefined,
    parentItemId: item.parentItemId ?? undefined,
    lastKnownLocation: item.lastKnownLocation ?? undefined,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    createdBy: item.createdBy,
    updatedBy: item.updatedBy,
    deletedAt: null,
  };
}

async function ensureNsnUnique(teamId: string, nsn: string, excludeId?: string) {
  const res = await doc.send(
    new QueryCommand({
      TableName: DDB_TABLE,
      IndexName: INDEX.itemsByNSN,
      KeyConditionExpression: "#gpk = :g AND #gsk = :nsn",
      ExpressionAttributeNames: { "#gpk": GSI_ATTR.nsnPK, "#gsk": GSI_ATTR.nsnSK },
      ExpressionAttributeValues: { ":g": gsi7pk(teamId), ":nsn": nsn },
      Limit: 2,
    })
  );
  const hits = (res.Items ?? []).filter((it) => !excludeId || it.id !== excludeId);
  if (hits.length > 0) throw new Error("Duplicate NSN");
}

export const itemProfilesRepo = {
  async findByNSN(teamId: string, nsn: string): Promise<ItemProfileRecord | null> {
    const res = await doc.send(
      new QueryCommand({
        TableName: DDB_TABLE,
        IndexName: INDEX.itemsByNSN,
        KeyConditionExpression: "#gpk = :g AND #gsk = :nsn",
        ExpressionAttributeNames: { "#gpk": GSI_ATTR.nsnPK, "#gsk": GSI_ATTR.nsnSK },
        ExpressionAttributeValues: { ":g": gsi7pk(teamId), ":nsn": nsn },
        Limit: 1,
      })
    );
    const item = (res.Items ?? [])[0];
    return fromDb(item);
  },
  async create(teamId: string, data: Omit<ItemProfileRecord, "id" | "deletedAt"> & { id?: string }): Promise<ItemProfileRecord> {
    await ensureNsnUnique(teamId, data.nsn);
    const id = data.id ?? randomUUID();
    const record: ItemProfileRecord = { ...data, id, deletedAt: null };
    const item = toDb(record);

    await doc.send(
      new PutCommand({
        TableName: DDB_TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );

    return record;
  },

  async update(teamId: string, id: string, patch: Partial<ItemProfileRecord>): Promise<ItemProfileRecord> {
    // If NSN is changing, re-check uniqueness
    if (patch.nsn) await ensureNsnUnique(teamId, patch.nsn, id);

    // Read current item
    const current = await doc.send(
      new GetCommand({ TableName: DDB_TABLE, Key: { PK: pk(teamId), SK: sk(id) } })
    );
    const existing = fromDb(current.Item);
    if (!existing) throw new Error("Not found");

    // Remove immutable fields
    const { id: _i, teamId: _t, createdAt: _ca, createdBy: _cb, ...mutable } = patch as any;

    const next: ItemProfileRecord = { ...existing, ...mutable };
    const item = toDb(next);

    await doc.send(
      new PutCommand({
        TableName: DDB_TABLE,
        Item: item,
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
      })
    );
    return next;
  },

  async softDelete(teamId: string, id: string): Promise<{ id: string }> {
    // Ensure exists and not already deleted
    const current = await doc.send(
      new GetCommand({ TableName: DDB_TABLE, Key: { PK: pk(teamId), SK: sk(id) } })
    );
    const exists = current.Item && !current.Item.deletedAt;
    if (!exists) throw new Error("Not found");

    const nowIso = new Date().toISOString();
    await doc.send(
      new UpdateCommand({
        TableName: DDB_TABLE,
        Key: { PK: pk(teamId), SK: sk(id) },
        UpdateExpression: "SET deletedAt = :d, updatedAt = :u",
        ExpressionAttributeValues: { ":d": nowIso, ":u": nowIso },
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK) AND attribute_not_exists(deletedAt)",
      })
    );
    return { id };
  },

  async hardDelete(teamId: string, id: string): Promise<{ id: string }> {
    await doc.send(
      new DeleteCommand({
        TableName: DDB_TABLE,
        Key: { PK: pk(teamId), SK: sk(id) },
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
      })
    );
    return { id };
  },

  async getById(teamId: string, id: string): Promise<ItemProfileRecord | null> {
    const res = await doc.send(
      new GetCommand({ TableName: DDB_TABLE, Key: { PK: pk(teamId), SK: sk(id) } })
    );
    return fromDb(res.Item) ?? null;
  },

  async list(
    teamId: string,
    args: z.infer<typeof ListItemProfilesInput>
  ): Promise<{ items: ItemProfileRecord[]; nextCursor?: string }> {
    // Cursor decode
    let ExclusiveStartKey: any | undefined;
    if (args.cursor) {
      try { ExclusiveStartKey = JSON.parse(Buffer.from(args.cursor, "base64").toString("utf-8")); }
      catch { ExclusiveStartKey = undefined; }
    }

    if (args.parentItemId) {
      // Query children via GSI2
      const res = await doc.send(
        new QueryCommand({
          TableName: DDB_TABLE,
          IndexName: INDEX.itemsByParent,
          KeyConditionExpression: "#p = :g2",
          ExpressionAttributeNames: { "#p": GSI_ATTR.parentPK },
          ExpressionAttributeValues: { ":g2": gsi2pk(teamId, args.parentItemId) },
          Limit: args.limit,
          ExclusiveStartKey,
          ScanIndexForward: args.order === "asc",
        })
      );
      const items = (res.Items ?? []).map(fromDb).filter(Boolean) as ItemProfileRecord[];
      const nextCursor = res.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(res.LastEvaluatedKey), "utf-8").toString("base64")
        : undefined;

      // Optional q filtering (client-side)
      const q = (args.q ?? "").toLowerCase();
      const filtered = q
        ? items.filter(
            (r) =>
              r.name.toLowerCase().includes(q) ||
              (r.description ?? "").toLowerCase().includes(q) ||
              r.nsn.toLowerCase().includes(q) ||
              (r.lastKnownLocation ?? "").toLowerCase().includes(q)
          )
        : items;

      return { items: filtered, nextCursor };
    }

    // Default: query all team items via PK
    const res = await doc.send(
      new QueryCommand({
        TableName: DDB_TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": pk(teamId), ":sk": "ITEM#" },
        Limit: args.limit,
        ExclusiveStartKey,
        ScanIndexForward: args.order === "asc",
      })
    );

    let items = (res.Items ?? []).map(fromDb).filter(Boolean) as ItemProfileRecord[];
    const q = (args.q ?? "").toLowerCase();
    if (q) {
      items = items.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          r.nsn.toLowerCase().includes(q) ||
          (r.lastKnownLocation ?? "").toLowerCase().includes(q)
      );
    }

    // Secondary sort if requested
    items.sort((a, b) => {
      let cmp = 0;
      if (args.orderBy === "name") cmp = a.name.localeCompare(b.name);
      else if (args.orderBy === "createdAt") cmp = a.createdAt.getTime() - b.createdAt.getTime();
      else cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      return args.order === "asc" ? cmp : -cmp;
    });

    const nextCursor = res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey), "utf-8").toString("base64")
      : undefined;

    return { items, nextCursor };
  },
};

/**
 * tRPC Router exposing Item Profile endpoints.
 */
export const itemProfilesRouter = router({
  /**
   * Create a new Item Profile.
   * - Requires `x-user-id` header and workspace/team id (from route param `:workspaceId` or legacy `x-team-id` header).
   * - Input: CreateItemProfileInput (nsn, name required; others optional).
   * - Output: Created ItemProfileRecord with audit fields.
   * - Errors:
   *    - UNAUTHORIZED if user header missing.
   *    - FORBIDDEN if team header missing.
   *    - BAD_REQUEST if validation fails.
   *    - INTERNAL_SERVER_ERROR on unexpected errors.
   * 
   * Example usage:
   *   trpc.itemProfiles.create.mutate({ nsn: "1234", name: "Item" });
   */
  create: publicProcedure
    .input(CreateItemProfileInput)
    .mutation(async ({ input, ctx }) => {
      const { userId, teamId } = authFromInput(input);
      // If a parent is provided, ensure it exists in the same team.
      if (input.parentItemId) {
        const parent = await itemProfilesRepo.getById(teamId, input.parentItemId);
        if (!parent) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `parentItemId not found: ${input.parentItemId}` });
        }
      }
      const safeKey = await ensureImageObjectExists(teamId, input.imageKey); // also enforces team prefix
      const audit = makeAuditOnCreate(userId, teamId);
      try {
        return await itemProfilesRepo.create(teamId, { ...input, imageKey: safeKey, ...audit });
      } catch (e) {
        throw mapRepoError(e);
      }
    }),

  /**
   * Update an existing Item Profile by ID.
   * - Requires `x-user-id` header and workspace/team id (from route param `:workspaceId` or legacy `x-team-id` header).
   * - Input: UpdateItemProfileInput (id and non-empty patch).
   * - Output: Updated ItemProfileRecord.
   * - Errors:
   *    - UNAUTHORIZED if user header missing.
   *    - FORBIDDEN if team header missing.
   *    - BAD_REQUEST if patch is empty or invalid.
   *    - NOT_FOUND if record does not exist.
   *    - INTERNAL_SERVER_ERROR on unexpected errors.
   * 
   * Example usage:
   *   trpc.itemProfiles.update.mutate({ id: "...", patch: { name: "New Name" } });
   */
  update: publicProcedure
    .input(UpdateItemProfileInput)
    .mutation(async ({ input, ctx }) => {
      const { userId, teamId } = authFromInput(input);
      // If caller is changing parent, ensure the new parent exists (same team).
      if (typeof input.patch.parentItemId !== "undefined" && input.patch.parentItemId) {
        const parent = await itemProfilesRepo.getById(teamId, input.patch.parentItemId);
        if (!parent) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `parentItemId not found: ${input.patch.parentItemId}` });
        }
      }
      // Enforces S3 key prefix: teams/{teamId}/...
      // If caller provided a new imageKey, validate prefix and ensure object exists.
      let imageKeyPatched = input.patch.imageKey;
      if (typeof imageKeyPatched !== "undefined") {
        imageKeyPatched = await ensureImageObjectExists(teamId, imageKeyPatched);
      }
      const patch = { ...input.patch, imageKey: imageKeyPatched, ...makeAuditOnUpdate(userId) };
      try {
        return await itemProfilesRepo.update(teamId, input.id, patch);
      } catch (e) {
        throw mapRepoError(e);
      }
    }),

  /**
   * Delete an Item Profile by ID.
   * - Supports soft delete (default) and hard delete via input.hard flag.
   * - Requires `x-user-id` header and workspace/team id (from route param `:workspaceId` or legacy `x-team-id` header).
   * - Input: DeleteItemProfileInput (id, optional hard boolean).
   * - Output: Object with deleted id.
   * - Errors:
   *    - UNAUTHORIZED if user header missing.
   *    - FORBIDDEN if team header missing.
   *    - NOT_FOUND if record does not exist.
   *    - INTERNAL_SERVER_ERROR on unexpected errors.
   *    - BAD_REQUEST if parentItemId refers to a non-existent item in the team.
   * 
   * Example usage:
   *   trpc.itemProfiles.delete.mutate({ id: "...", hard: false });
   */
  delete: publicProcedure
    .input(DeleteItemProfileInput)
    .mutation(async ({ input, ctx }) => {
      const { userId, teamId } = authFromInput(input);
      try {
        return input.hard
          ? await itemProfilesRepo.hardDelete(teamId, input.id)
          : await itemProfilesRepo.softDelete(teamId, input.id);
      } catch (e) {
        throw mapRepoError(e);
      }
    }),

  /**
   * Retrieve an Item Profile by ID.
   * - Requires `x-user-id` header and workspace/team id (from route param `:workspaceId` or legacy `x-team-id` header).
   * - Input: Object with id string.
   * - Output: ItemProfileRecord if found.
   * - Errors:
   *    - UNAUTHORIZED if user header missing.
   *    - FORBIDDEN if team header missing.
   *    - NOT_FOUND if record does not exist or is deleted.
   *    - INTERNAL_SERVER_ERROR on unexpected errors.
   * 
   * Example usage:
   *   trpc.itemProfiles.getById.query({ id: "..." });
   */
  getById: publicProcedure
    .input(z.object({ id: IdSchema }).and(AuthInput))
    .query(async ({ input, ctx }) => {
      const { userId, teamId } = authFromInput(input);
      try {
        const rec = await itemProfilesRepo.getById(teamId, input.id);
        if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
        return rec;
      } catch (e) {
        throw mapRepoError(e);
      }
    }),

  /**
   * Retrieve an Item Profile by NSN (within a team/workspace).
   * Requires x-user-id header and workspace/team id (from route param :workspaceId or legacy x-team-id header).
   * - Input: { nsn: string }
   * - Output: ItemProfileRecord if found, NOT_FOUND otherwise.
   */
  findByNSN: publicProcedure
    .input(z.object({ nsn: z.string().min(1) }).and(AuthInput))
    .query(async ({ input, ctx }) => {
      const { userId, teamId } = authFromInput(input);
      try {
        const rec = await itemProfilesRepo.findByNSN(teamId, input.nsn);
        if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
        return rec;
      } catch (e) {
        throw mapRepoError(e);
      }
    }),

  /**
   * List Item Profiles with optional filters, pagination, and ordering.
   * - Requires x-user-id header and workspace/team id (from route param :workspaceId or legacy x-team-id header).
   * - Input: ListItemProfilesInput (q, parentItemId, limit, cursor, orderBy, order).
   * - Output: Object with items array and optional nextCursor string.
   * - Errors:
   *    - UNAUTHORIZED if user header missing.
   *    - FORBIDDEN if team header missing.
   *    - INTERNAL_SERVER_ERROR on unexpected errors.
   * 
   * Example usage:
   *   trpc.itemProfiles.list.query({ limit: 20, q: "widget" });
   */
  list: publicProcedure
    .input(ListItemProfilesInput)
    .query(async ({ input, ctx }) => {
      const { userId, teamId } = authFromInput(input);
      try {
        return await itemProfilesRepo.list(teamId, input);
      } catch (e) {
        throw mapRepoError(e);
      }
    }),
});

export type ItemProfilesRouter = typeof itemProfilesRouter;