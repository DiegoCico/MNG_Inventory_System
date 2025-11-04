/**
 * Item Profiles Router
 * ============================================================================
 * Overview:
 * ----------------------------------------------------------------------------
 * This router manages Item Profiles within the Inventory Management System.
 * Item Profiles represent detailed metadata about inventory items scoped per team,
 * including identifiers like NSN (National Stock Number), descriptions, images,
 * hierarchical relationships, and location data.
 * 
 * This router provides a set of CRUD and listing endpoints that enforce authentication,
 * team-based scoping, and data integrity. It integrates with other system components
 * such as S3 for image storage (via imageKey references) and supports pagination
 * and filtering for efficient data retrieval.
 *
 * Quickstart for developers:
 * ----------------------------------------------------------------------------
 * - Mount the router in your main API router:
 *     import { itemProfilesRouter } from "./itemProfiles";
 *     export const appRouter = router({
 *       itemProfiles: itemProfilesRouter,
 *       // other routers...
 *     });
 *
 * - Calling from a tRPC client:
 *     // Example: create a new item profile
 *     const newItem = await trpc.itemProfiles.create.mutate({
 *       nsn: "1234-5678-90",
 *       name: "Widget A",
 *       description: "A standard widget",
 *       imageKey: "teams/<teamId>/images/widget-a.jpg", // key from S3 presigned upload
 *       parentItemId: undefined,
 *       lastKnownLocation: "Warehouse 5",
 *     });
 *
 *     // Example: get by id
 *     const byId = await trpc.itemProfiles.getById.query({ id: "..." });
 *
 *     // Example: find by NSN
 *     const byNsn = await trpc.itemProfiles.findByNSN.query({ nsn: "1234-5678-90" });
 *
 * - Typical request/response structure:
 *     Input: JSON object with required fields (nsn, name) and optional metadata.
 *     Output: Full ItemProfileRecord including generated IDs and audit fields.
 *
 * - Image handling:
 *     This router validates the key prefix (teams/{teamId}/) and verifies the object exists in S3 via HeadObject before saving.
 *
 * Environment:
 *   - Requires process.env.DDB_TABLE and process.env.S3_BUCKET to be set. The router throws at startup if missing.
 * 
 * Authentication & Team Scoping:
 * ----------------------------------------------------------------------------
 * - All endpoints require:
 *     - x-user-id header (string)
 *     - team/workspace id from URL param `:workspaceId` (preferred) or legacy `x-team-id` header
 * - Missing user → UNAUTHORIZED; missing team/workspace → FORBIDDEN.
 * - All operations are scoped to teamId to prevent cross-team access.
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

/** Resolve team/workspace id from URL (preferred) or headers as a fallback */
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

/** Assert imageKey lives under this team's prefix so S3 objects can't be spoofed across teams */
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

/** Ensure the referenced S3 object exists; throws BAD_REQUEST if it does not. */
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

/**
 * Schema for ID strings.
 * Must be a non-empty string.
 */
const IdSchema = z.string().min(1, "required");

/**
 * Base schema for ItemProfile input.
 * - nsn and name are required non-empty strings.
 * - description, imageKey, parentItemId, lastKnownLocation are optional.
 * - imageKey represents an S3 object key for associated images.
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
});

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
});

/**
 * Input schema for delete operation.
 * Requires id and optional hard flag indicating hard vs soft delete.
 */
const DeleteItemProfileInput = z.object({
  id: IdSchema,
  hard: z.boolean().default(false),
});

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
});

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
 * Repository layer implementing CRUD and list operations for Item Profiles using DynamoDB.
 * Assumes table with PK/SK and two GSIs:
 *  - GSI_ItemsByNSN (NSN uniqueness):  GSI7PK = TEAM#{teamId}#NSN, GSI7SK = nsn
 *  - GSI_ItemsByParent (Parent listing):  GSI2PK = TEAM#{teamId}#PARENT#{parent|ROOT}, GSI2SK = updatedAt ISO
 */
/** Fetch required env var or throw at startup to avoid silent misconfig. */
function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`[itemProfiles] Missing required environment variable: ${name}`);
  }
  return v;
}

const DDB_TABLE = requiredEnv("DDB_TABLE");
const S3_BUCKET = requiredEnv("S3_BUCKET");

// Key builders
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

    // GSIs
    GSI7PK: gsi7pk(rec.teamId),                 // for GSI_ItemsByNSN
    GSI7SK: rec.nsn,
    GSI2PK: gsi2pk(rec.teamId, rec.parentItemId ?? undefined), // for GSI_ItemsByParent
    GSI2SK: rec.updatedAt.toISOString(),

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
      IndexName: "GSI_ItemsByNSN",
      KeyConditionExpression: "GSI7PK = :g AND GSI7SK = :nsn",
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
        IndexName: "GSI_ItemsByNSN",
        KeyConditionExpression: "GSI7PK = :g AND GSI7SK = :nsn",
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
          IndexName: "GSI_ItemsByParent",
          KeyConditionExpression: "GSI2PK = :g2",
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
   * - Requires x-user-id and x-team-id headers.
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
      const userId = requireUserId(ctx);
      const teamId = requireTeamId(ctx);
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
   * - Requires x-user-id and x-team-id headers.
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
      const userId = requireUserId(ctx);
      const teamId = requireTeamId(ctx);
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
   * - Requires x-user-id and x-team-id headers.
   * - Input: DeleteItemProfileInput (id, optional hard boolean).
   * - Output: Object with deleted id.
   * - Errors:
   *    - UNAUTHORIZED if user header missing.
   *    - FORBIDDEN if team header missing.
   *    - NOT_FOUND if record does not exist.
   *    - INTERNAL_SERVER_ERROR on unexpected errors.
   * 
   * Example usage:
   *   trpc.itemProfiles.delete.mutate({ id: "...", hard: false });
   */
  delete: publicProcedure
    .input(DeleteItemProfileInput)
    .mutation(async ({ input, ctx }) => {
      requireUserId(ctx);
      const teamId = requireTeamId(ctx);
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
   * - Requires x-user-id and x-team-id headers.
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
    .input(z.object({ id: IdSchema }))
    .query(async ({ input, ctx }) => {
      requireUserId(ctx);
      const teamId = requireTeamId(ctx);
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
   * - Requires x-user-id and team/workspace id.
   * - Input: { nsn: string }
   * - Output: ItemProfileRecord if found, NOT_FOUND otherwise.
   */
  findByNSN: publicProcedure
    .input(z.object({ nsn: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      requireUserId(ctx);
      const teamId = requireTeamId(ctx);
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
   * - Requires x-user-id and x-team-id headers.
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
      requireUserId(ctx);
      const teamId = requireTeamId(ctx);
      try {
        return await itemProfilesRepo.list(teamId, input);
      } catch (e) {
        throw mapRepoError(e);
      }
    }),
});

export type ItemProfilesRouter = typeof itemProfilesRouter;