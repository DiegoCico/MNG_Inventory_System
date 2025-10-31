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
 *       imageKey: "images/widget-a.jpg", // key from S3 presigned upload
 *       parentItemId: undefined,
 *       lastKnownLocation: "Warehouse 5",
 *     });
 *
 * - Typical request/response structure:
 *     Input: JSON object with required fields (nsn, name) and optional metadata.
 *     Output: Full ItemProfileRecord including generated IDs and audit fields.
 *
 * - Image handling:
 *     The imageKey field stores the S3 object key obtained via a separate S3 presign flow.
 *     Clients should upload images to S3 using presigned URLs, then store the key here.
 *
 * Authentication & Team Scoping:
 * ----------------------------------------------------------------------------
 * - All endpoints require the following headers to be set:
 *     - x-user-id: identifies the authenticated user (string)
 *     - x-team-id: identifies the team context (string)
 * - Missing or invalid headers result in UNAUTHORIZED or FORBIDDEN errors.
 * - All operations are scoped to the teamId to prevent cross-team data access.
 */

import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";

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
 * Requires and returns the team ID from headers.
 * Throws TRPCError(FORBIDDEN) if missing.
 * @param ctx - The tRPC context.
 * @returns The team ID string.
 * @throws TRPCError if team ID header is missing.
 */
function requireTeamId(ctx: Ctx): string {
  const teamId = headerLookup(ctx, "x-team-id");
  if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Missing team" });
  return teamId;
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
 * Internal in-memory data store:
 * Maps teamId to a Map of itemId -> ItemProfileRecord.
 */
const _store = new Map<string, Map<string, ItemProfileRecord>>(); // teamId -> (id -> record)

/** 
 * Retrieves or creates the Map of ItemProfileRecords for a given team.
 * @param teamId - The team identifier.
 * @returns The Map of itemId to ItemProfileRecord for the team.
 */
function getTeamMap(teamId: string): Map<string, ItemProfileRecord> {
  let teamMap = _store.get(teamId);
  if (!teamMap) { teamMap = new Map(); _store.set(teamId, teamMap); }
  return teamMap;
}

/**
 * Repository layer implementing CRUD and list operations for Item Profiles.
 */
export const itemProfilesRepo = {
  /**
   * Creates a new Item Profile record.
   * Throws Error("Duplicate NSN") if an active record with the same nsn exists in the team.
   * @param teamId - The team ID to scope the record.
   * @param data - The data for the new record, excluding id and deletedAt.
   * @returns The created ItemProfileRecord with id and audit fields.
   * @throws Error if NSN is already used by another active record.
   */
  async create(teamId: string, data: Omit<ItemProfileRecord, "id" | "deletedAt"> & { id?: string }): Promise<ItemProfileRecord> {
    const teamMap = getTeamMap(teamId);
    const id = data.id ?? randomUUID();

    // Enforce unique NSN within the team (excluding soft-deleted records)
    for (const rec of teamMap.values()) {
      if (rec.deletedAt == null && rec.nsn === data.nsn) {
        throw new Error("Duplicate NSN");
      }
    }
    const record: ItemProfileRecord = { ...data, id, deletedAt: null };
    teamMap.set(id, record);
    return record;
  },

  /**
   * Updates an existing Item Profile record by ID.
   * Throws Error("Not found") if the record does not exist or is soft-deleted.
   * Throws Error("Duplicate NSN") if patch changes nsn to one already in use.
   * Immutable fields (id, teamId, createdAt, createdBy) cannot be changed.
   * @param teamId - The team ID for scoping.
   * @param id - The item profile ID to update.
   * @param patch - Partial fields to update.
   * @returns The updated ItemProfileRecord.
   * @throws Error if not found or duplicate NSN.
   */
  async update(teamId: string, id: string, patch: Partial<ItemProfileRecord>): Promise<ItemProfileRecord> {
    const teamMap = getTeamMap(teamId);
    const existing = teamMap.get(id);
    if (!existing || existing.deletedAt != null) throw new Error("Not found");

    // Remove immutable fields from patch to prevent modification
    const immutableFields = ["id", "teamId", "createdAt", "createdBy"];
    for (const field of immutableFields) {
      if (field in patch) delete (patch as any)[field];
    }

    // Check NSN uniqueness if changed
    if (patch.nsn && patch.nsn !== existing.nsn) {
      for (const [otherId, rec] of teamMap.entries()) {
        if (rec.deletedAt == null && rec.nsn === patch.nsn && otherId !== id) {
          throw new Error("Duplicate NSN");
        }
      }
    }

    const updated: ItemProfileRecord = { ...existing, ...patch };
    teamMap.set(id, updated);
    return updated;
  },

  /**
   * Performs a soft delete on an Item Profile by setting deletedAt.
   * Throws Error("Not found") if record does not exist or is already deleted.
   * @param teamId - The team ID for scoping.
   * @param id - The item profile ID to soft delete.
   * @returns Object with deleted id.
   * @throws Error if not found or already deleted.
   */
  async softDelete(teamId: string, id: string): Promise<{ id: string }> {
    const teamMap = getTeamMap(teamId);
    const existing = teamMap.get(id);
    if (!existing || existing.deletedAt != null) throw new Error("Not found");
    const updated = { ...existing, deletedAt: new Date() };
    teamMap.set(id, updated);
    return { id };
  },

  /**
   * Performs a hard delete by removing the record from the store.
   * Throws Error("Not found") if the record does not exist.
   * @param teamId - The team ID for scoping.
   * @param id - The item profile ID to hard delete.
   * @returns Object with deleted id.
   * @throws Error if not found.
   */
  async hardDelete(teamId: string, id: string): Promise<{ id: string }> {
    const teamMap = getTeamMap(teamId);
    const deleted = teamMap.delete(id);
    if (!deleted) throw new Error("Not found");
    return { id };
  },

  /**
   * Retrieves an Item Profile by ID.
   * Returns null if not found or soft-deleted.
   * @param teamId - The team ID for scoping.
   * @param id - The item profile ID to retrieve.
   * @returns The ItemProfileRecord or null.
   */
  async getById(teamId: string, id: string): Promise<ItemProfileRecord | null> {
    const teamMap = getTeamMap(teamId);
    const rec = teamMap.get(id);
    if (!rec || rec.deletedAt != null) return null;
    return rec;
  },

  /**
   * Lists Item Profiles with optional filtering, pagination, and ordering.
   * Supports search query on multiple text fields and parentItemId filtering.
   * Pagination uses cursor as a base64-encoded offset.
   * @param teamId - The team ID for scoping.
   * @param args - Listing parameters including filters, limit, cursor, orderBy, order.
   * @returns Object with items array and optional nextCursor for pagination.
   */
  async list(teamId: string, args: z.infer<typeof ListItemProfilesInput>): Promise<{ items: ItemProfileRecord[]; nextCursor?: string }> {
    const teamMap = getTeamMap(teamId);
    let items = Array.from(teamMap.values()).filter(r => r.deletedAt == null);

    // Apply search query filter (case-insensitive match on multiple fields)
    if (args.q) {
      const qlc = args.q.toLowerCase();
      items = items.filter(r => {
        if (r.name.toLowerCase().includes(qlc)) return true;
        if ((r.description ?? "").toLowerCase().includes(qlc)) return true;
        if (r.nsn.toLowerCase().includes(qlc)) return true;
        if ((r.lastKnownLocation ?? "").toLowerCase().includes(qlc)) return true;
        return false;
      });
    }
    // Filter by parentItemId if provided
    if (args.parentItemId) items = items.filter(r => r.parentItemId === args.parentItemId);

    // Sort items by specified field and order
    items.sort((a, b) => {
      let cmp = 0;
      if (args.orderBy === "name") cmp = a.name.localeCompare(b.name);
      else if (args.orderBy === "createdAt") cmp = a.createdAt.getTime() - b.createdAt.getTime();
      else cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      return args.order === "asc" ? cmp : -cmp;
    });

    // Cursor pagination: decode base64 cursor to offset index
    let offset = 0;
    if (args.cursor) {
      try {
        const decoded = Buffer.from(args.cursor, "base64").toString("utf-8");
        offset = parseInt(decoded, 10);
        if (isNaN(offset) || offset < 0) offset = 0;
      } catch { offset = 0; }
    }

    // Slice items for current page
    const pageItems = items.slice(offset, offset + args.limit);
    const nextOffset = offset + pageItems.length;

    // If more items exist, encode next cursor as base64 offset string
    const nextCursor = nextOffset < items.length ? Buffer.from(nextOffset.toString(), "utf-8").toString("base64") : undefined;

    return { items: pageItems, nextCursor };
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
      const audit = makeAuditOnCreate(userId, teamId);
      try {
        return await itemProfilesRepo.create(teamId, { ...input, ...audit });
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
      const patch = { ...input.patch, ...makeAuditOnUpdate(userId) };
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