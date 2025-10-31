/**
 * Item Profiles Router
 * ============================================================================
 * What this is:
 * ----------------------------------------------------------------------------
 * This file defines the tRPC router for managing Item Profiles in the Inventory
 * Management System. Item Profiles are per-team records describing inventory
 * items, their metadata, and categorization. This router exposes CRUD and
 * listing endpoints, with authentication and team scoping enforced via headers.
 *
 * How to use:
 * ----------------------------------------------------------------------------
 * - Mounting in routers/index.ts:
 *     import { itemProfilesRouter } from "./itemProfiles";
 *     export const appRouter = router({
 *       itemProfiles: itemProfilesRouter,
 *       // ...
 *     });
 *
 * - Calling from server tests (with Express or Lambda headers):
 *     const caller = appRouter.createCaller({
 *       req: { headers: { "x-user-id": "user1", "x-team-id": "teamA" } },
 *       event: undefined,
 *     });
 *     await caller.itemProfiles.create({ name: "...", ... });
 *
 *     // Lambda (API Gateway event)
 *     const lambdaCaller = appRouter.createCaller({
 *       req: undefined,
 *       event: { headers: { "x-user-id": "user1", "x-team-id": "teamA" } },
 *     });
 *
 * - Calling from web client via tRPC proxy:
 *     const { data } = trpc.itemProfiles.list.useQuery({ limit: 20 });
 *     // Ensure x-user-id and x-team-id are sent by your proxy/middleware.
 *
 * Inputs & Outputs:
 * ----------------------------------------------------------------------------
 * - create(input): Required fields: name, sku, category. Optional: id (uuid), description, tags, attributes.
 *     Returns: ItemProfileRecord (all fields, including id, audit, teamId)
 * - update(input): Required: id, patch (at least one updatable field). Patch can contain any updatable field.
 *     Returns: Updated ItemProfileRecord.
 * - delete(input): Required: id. Optional: hard (boolean, default false).
 *     Returns: { id: string }
 * - getById(input): Required: id.
 *     Returns: ItemProfileRecord, or throws NOT_FOUND.
 * - list(input): Optional filters: q (search), category, tag, pagination (limit, cursor), orderBy/order.
 *     Returns: { items: ItemProfileRecord[], nextCursor?: string }
 *
 * Auth & Team Scoping:
 * ----------------------------------------------------------------------------
 * - All endpoints require both headers:
 *     - x-user-id: user identifier (string)
 *     - x-team-id: team identifier (string)
 * - Missing x-user-id: throws TRPCError(UNAUTHORIZED)
 * - Missing x-team-id: throws TRPCError(FORBIDDEN)
 * - All data is scoped to the teamId; cross-team access is forbidden.
 *
 * Implementation details:
 * ----------------------------------------------------------------------------
 * - Header extraction: Handles both Express (req.headers) and Lambda (event.headers).
 * - Audit stamping: create/update methods automatically stamp createdAt, updatedAt, createdBy, updatedBy, teamId.
 * - Repo abstraction: All DB operations are delegated to itemProfilesRepo (stubbed here).
 * - Error mapping: All errors are mapped to TRPCError; known errors pass through, unknowns get INTERNAL_SERVER_ERROR.
 * - Soft vs hard delete: delete() supports soft (sets deletedAt) and hard (removes record).
 * - Pagination: list() supports cursor-based pagination and ordering.
 *
 * Extensibility notes:
 * ----------------------------------------------------------------------------
 * - Uniqueness constraints (e.g., sku/teamId) should be enforced in the repo layer.
 * - Role checks (admin, editor, etc.) can be added by inspecting userId/teamId and extending guards.
 * - Eventing (audit logs, webhooks) can be triggered in the repo or router layer.
 */
// File: src/api/src/routers/itemProfiles.ts

import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";

/** ──────────────────────────────────────────────────────────────────────────
 * Helpers: extract user/team from either Express (ctx.req) or Lambda (ctx.event)
 * We do NOT change trpc.ts; we just read headers here.
 * - You can align header names with whatever your S3/workspace routes already use.
 *   For now we default to:  x-user-id, x-team-id
 * ────────────────────────────────────────────────────────────────────────── */
type Ctx = import("./trpc").Context;

function headerLookup(ctx: Ctx, key: string): string | undefined {
  // Express
  const h1 = ctx.req?.headers?.[key.toLowerCase()];
  if (typeof h1 === "string") return h1;
  if (Array.isArray(h1)) return h1[0];

  // API Gateway v2 (Lambda)
  const h2 = ctx.event?.headers?.[key] ?? ctx.event?.headers?.[key.toLowerCase()];
  if (typeof h2 === "string") return h2;

  return undefined;
}

function requireUserId(ctx: Ctx): string {
  const userId = headerLookup(ctx, "x-user-id");
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing user" });
  return userId;
}

function requireTeamId(ctx: Ctx): string {
  const teamId = headerLookup(ctx, "x-team-id");
  if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Missing team" });
  return teamId;
}

function now() {
  return new Date();
}

function makeAuditOnCreate(userId: string, teamId: string) {
  const ts = now();
  return {
    createdAt: ts,
    updatedAt: ts,
    createdBy: userId,
    updatedBy: userId,
    teamId,
  };
}
function makeAuditOnUpdate(userId: string) {
  return { updatedAt: now(), updatedBy: userId };
}

function mapRepoError(e: unknown): TRPCError {
  const maybeCode = (e as any)?.code;
  if (typeof maybeCode === "string") {
    // Already a TRPC-shaped error; pass through unchanged.
    return e as TRPCError;
  }
  const msg = (e as any)?.message ?? "Unexpected error";
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg, cause: e });
}

/** Schemas (unchanged from earlier) **/
const IdSchema = z.string().min(1, "required");

const ItemProfileBase = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  sku: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  attributes: z.record(z.string(), z.any()).default({}),
});

const CreateItemProfileInput = ItemProfileBase.extend({
  id: z.string().uuid().optional(),
});

// PATCH schema WITHOUT defaults, so {} stays empty and is rejected
const ItemProfilePatch = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sku: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

const UpdateItemProfileInput = z.object({
  id: IdSchema,
  patch: ItemProfilePatch.refine((p) => p && Object.keys(p).length > 0, {
    message: "patch cannot be empty",
  }),
});

const DeleteItemProfileInput = z.object({
  id: IdSchema,
  hard: z.boolean().default(false),
});

const ListItemProfilesInput = z.object({
  q: z.string().trim().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  orderBy: z.enum(["createdAt", "updatedAt", "name"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});


/** Repo layer (in-memory implementation) **/
export type ItemProfileRecord = z.infer<typeof ItemProfileBase> & {
  id: string;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
};

const _store = new Map<string, Map<string, ItemProfileRecord>>(); // teamId -> (id -> record)

function getTeamMap(teamId: string): Map<string, ItemProfileRecord> {
  let teamMap = _store.get(teamId);
  if (!teamMap) {
    teamMap = new Map();
    _store.set(teamId, teamMap);
  }
  return teamMap;
}

export const itemProfilesRepo = {
  async create(teamId: string, data: Omit<ItemProfileRecord, "id" | "deletedAt"> & { id?: string }): Promise<ItemProfileRecord> {
    const teamMap = getTeamMap(teamId);
    const id = data.id ?? randomUUID();

    // Check SKU uniqueness within team
    for (const rec of teamMap.values()) {
      if (rec.deletedAt == null && rec.sku === data.sku) {
        throw new Error("Duplicate SKU");
      }
    }

    const record: ItemProfileRecord = {
      ...data,
      id,
      deletedAt: null,
    };
    teamMap.set(id, record);
    return record;
  },

  async update(teamId: string, id: string, patch: Partial<ItemProfileRecord>): Promise<ItemProfileRecord> {
    const teamMap = getTeamMap(teamId);
    const existing = teamMap.get(id);
    if (!existing || existing.deletedAt != null) {
      throw new Error("Not found");
    }

    // Block immutable fields updates
    const immutableFields = ["id", "teamId", "createdAt", "createdBy"];
    for (const field of immutableFields) {
      if (field in patch) {
        delete patch[field as keyof ItemProfileRecord];
      }
    }

    // If sku is changing, check uniqueness
    if (patch.sku && patch.sku !== existing.sku) {
      for (const [otherId, rec] of teamMap.entries()) {
        if (rec.deletedAt == null && rec.sku === patch.sku && otherId !== id) {
          throw new Error("Duplicate SKU");
        }
      }
    }

    const updated: ItemProfileRecord = { ...existing, ...patch };
    teamMap.set(id, updated);
    return updated;
  },

  async softDelete(teamId: string, id: string): Promise<{ id: string }> {
    const teamMap = getTeamMap(teamId);
    const existing = teamMap.get(id);
    if (!existing || existing.deletedAt != null) {
      throw new Error("Not found");
    }
    const updated = { ...existing, deletedAt: new Date() };
    teamMap.set(id, updated);
    return { id };
  },

  async hardDelete(teamId: string, id: string): Promise<{ id: string }> {
    const teamMap = getTeamMap(teamId);
    const deleted = teamMap.delete(id);
    if (!deleted) {
      throw new Error("Not found");
    }
    return { id };
  },

  async getById(teamId: string, id: string): Promise<ItemProfileRecord | null> {
    const teamMap = getTeamMap(teamId);
    const rec = teamMap.get(id);
    if (!rec || rec.deletedAt != null) return null;
    return rec;
  },

  async list(teamId: string, args: z.infer<typeof ListItemProfilesInput>): Promise<{ items: ItemProfileRecord[]; nextCursor?: string }> {
    const teamMap = getTeamMap(teamId);
    let items = Array.from(teamMap.values()).filter(r => r.deletedAt == null);

    // Apply filters
    if (args.q) {
      const qlc = args.q.toLowerCase();
      items = items.filter(r => {
        if (r.name.toLowerCase().includes(qlc)) return true;
        if (r.description.toLowerCase().includes(qlc)) return true;
        if (r.sku.toLowerCase().includes(qlc)) return true;
        if (r.tags.some(t => t.toLowerCase().includes(qlc))) return true;
        return false;
      });
    }
    if (args.category) {
      items = items.filter(r => r.category === args.category);
    }
    if (args.tag) {
      items = items.filter(r => r.tags.includes(args.tag!));
    }

    // Sort
    items.sort((a, b) => {
      let cmp = 0;
      if (args.orderBy === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (args.orderBy === "createdAt") {
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
      } else if (args.orderBy === "updatedAt") {
        cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      }
      return args.order === "asc" ? cmp : -cmp;
    });

    // Cursor pagination: cursor is base64 encoded offset string
    let offset = 0;
    if (args.cursor) {
      try {
        const decoded = Buffer.from(args.cursor, "base64").toString("utf-8");
        offset = parseInt(decoded, 10);
        if (isNaN(offset) || offset < 0) offset = 0;
      } catch {
        offset = 0;
      }
    }

    const pageItems = items.slice(offset, offset + args.limit);
    const nextOffset = offset + pageItems.length;
    const nextCursor = nextOffset < items.length ? Buffer.from(nextOffset.toString(), "utf-8").toString("base64") : undefined;

    return { items: pageItems, nextCursor };
  },
};

/** Router: now uses publicProcedure + inline guards **/
export const itemProfilesRouter = router({
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

  getById: publicProcedure
    .input(z.object({ id: IdSchema }))
    .query(async ({ input, ctx }) => {
        requireUserId(ctx);
        const teamId = requireTeamId(ctx);
        try {
        const rec = await itemProfilesRepo.getById(teamId, input.id);
        if (!rec) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
        }
        return rec;
        } catch (e) {
        throw mapRepoError(e);
        }
    }),

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