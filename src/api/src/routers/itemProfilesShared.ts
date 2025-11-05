import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { doc, s3Client } from "../aws";
import {
  PutCommand,
  UpdateCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

// --- Environment with safe defaults (dev-friendly) -------------------------
const DEFAULT_ENV = {
  DDB_TABLE: "mng-dev-data",
  S3_BUCKET: "mng-dev-assets",
  AWS_REGION: "us-east-1",
} as const;

function envOrDefault(name: keyof typeof DEFAULT_ENV): string {
  const val = process.env[name]?.trim();
  if (val) return val;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set in production environment`);
  }
  return DEFAULT_ENV[name];
}

export const DDB_TABLE = envOrDefault("DDB_TABLE");
export const S3_BUCKET = envOrDefault("S3_BUCKET");
export const AWS_REGION = envOrDefault("AWS_REGION");

// --- Index names & attribute names (env-overridable) -----------------------
export const INDEX = {
  itemsByNSN: process.env.GSI_ITEMS_BY_NSN?.trim() || "GSI_ItemsByNSN",
  itemsByParent: process.env.GSI_ITEMS_BY_PARENT?.trim() || "GSI_ItemsByParent",
} as const;

export const GSI_ATTR = {
  nsnPK: process.env.GSI7PK_ATTR?.trim() || "GSI7PK",
  nsnSK: process.env.GSI7SK_ATTR?.trim() || "GSI7SK",
  parentPK: process.env.GSI2PK_ATTR?.trim() || "GSI2PK",
  parentSK: process.env.GSI2SK_ATTR?.trim() || "GSI2SK",
} as const;

// --- Key builders -----------------------------------------------------------
export const pk = (teamId: string) => `TEAM#${teamId}`;
export const sk = (id: string) => `ITEM#${id}`;
export const gsi7pk = (teamId: string) => `TEAM#${teamId}#NSN`;
export const gsi2pk = (teamId: string, parentItemId?: string) =>
  `TEAM#${teamId}#PARENT#${parentItemId ?? "ROOT"}`;

// --- Image utils ------------------------------------------------------------
export function assertValidImageKey(teamId: string, imageKey?: string) {
  if (!imageKey) return;
  const allowedPrefix = `teams/${teamId}/`;
  if (!imageKey.startsWith(allowedPrefix)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `imageKey must start with ${allowedPrefix}`,
    });
  }
}
export function normalizeImageKey(key?: string): string | undefined {
  if (!key) return undefined;
  const trimmed = key.trim();
  return trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
}
export function sanitizeSegment(seg: string): string {
  return seg
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
export function buildImageKey(
  teamId: string,
  nsnOrHint: string,
  filename: string
) {
  const safeTeam = sanitizeSegment(teamId);
  const safeHint = sanitizeSegment(nsnOrHint || "item");
  const safeFile = sanitizeSegment(filename);
  return `teams/${safeTeam}/items/${safeHint}/${safeFile}`;
}
export async function ensureImageObjectExists(
  teamId: string,
  rawKey?: string
): Promise<string | undefined> {
  const imageKey = normalizeImageKey(rawKey);
  if (!imageKey) return undefined;
  assertValidImageKey(teamId, imageKey);
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: imageKey })
    );
    return imageKey;
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `imageKey does not exist in bucket ${S3_BUCKET}: ${imageKey}`,
    });
  }
}

// --- Audit & error helpers --------------------------------------------------
export const now = () => new Date();
export function makeAuditOnCreate(userId: string, teamId: string) {
  const ts = now();
  return {
    createdAt: ts,
    updatedAt: ts,
    createdBy: userId,
    updatedBy: userId,
    teamId,
  };
}
export function makeAuditOnUpdate(userId: string) {
  return { updatedAt: now(), updatedBy: userId };
}
export function mapRepoError(e: unknown): TRPCError {
  const maybeCode = (e as any)?.code;
  if (typeof maybeCode === "string") return e as TRPCError;
  const msg = (e as any)?.message ?? "Unexpected error";
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: msg,
    cause: e,
  });
}

// --- Schemas ----------------------------------------------------------------
export const AuthInput = z.object({
  userId: z.string().min(1),
  teamId: z.string().min(1),
});
export function authFromInput(input: { userId: string; teamId: string }) {
  return { userId: input.userId, teamId: input.teamId };
}
export const IdSchema = z.string().min(1, "required");
export const ItemProfileBase = z.object({
  nsn: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  imageKey: z.string().min(1).optional(),
  parentItemId: z.string().min(1).optional(),
  lastKnownLocation: z.string().optional(),
});
export const ImageInput = z.object({
  filename: z.string().min(1),
  dirHint: z.string().min(1).optional(),
});
export const CreateItemProfileInput = ItemProfileBase.extend({
  id: z.string().uuid().optional(),
  image: ImageInput.optional(),
}).and(AuthInput);
export const ItemProfilePatch = z.object({
  nsn: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  imageKey: z.string().min(1).optional(),
  image: ImageInput.optional(),
  parentItemId: z.string().min(1).optional(),
  lastKnownLocation: z.string().optional(),
});
export const UpdateItemProfileInput = z
  .object({
    id: IdSchema,
    patch: ItemProfilePatch.refine(
      (p) => p && Object.keys(p).length > 0,
      { message: "patch cannot be empty" }
    ),
  })
  .and(AuthInput);
export const DeleteItemProfileInput = z
  .object({ id: IdSchema, hard: z.boolean().default(false) })
  .and(AuthInput);
export const ListItemProfilesInput = z
  .object({
    q: z.string().trim().optional(),
    parentItemId: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
    orderBy: z.enum(["createdAt", "updatedAt", "name"]).default("updatedAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .and(AuthInput);

// --- Types ------------------------------------------------------------------
export type ItemProfileRecord = z.infer<typeof ItemProfileBase> & {
  id: string;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
};

// --- Repo -------------------------------------------------------------------
export function toDb(rec: ItemProfileRecord) {
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
    [GSI_ATTR.nsnPK]: gsi7pk(rec.teamId),
    [GSI_ATTR.nsnSK]: rec.nsn,
    [GSI_ATTR.parentPK]: gsi2pk(rec.teamId, rec.parentItemId ?? undefined),
    [GSI_ATTR.parentSK]: rec.updatedAt.toISOString(),
    entity: "ItemProfile",
  };
}
export function fromDb(item: any): ItemProfileRecord | null {
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
export async function ensureNsnUnique(
  teamId: string,
  nsn: string,
  excludeId?: string
) {
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
  const hits = (res.Items ?? []).filter(
    (it) => !excludeId || it.id !== excludeId
  );
  if (hits.length > 0) throw new Error("Duplicate NSN");
}
export const itemProfilesRepo = {
  async findByNSN(teamId: string, nsn: string) {
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
  async create(
    teamId: string,
    data: Omit<ItemProfileRecord, "id" | "deletedAt"> & { id?: string }
  ) {
    await ensureNsnUnique(teamId, data.nsn);
    const id = data.id ?? randomUUID();
    const record: ItemProfileRecord = { ...data, id, deletedAt: null };
    const item = toDb(record);
    await doc.send(
      new PutCommand({
        TableName: DDB_TABLE,
        Item: item,
        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
    return record;
  },
  async update(
    teamId: string,
    id: string,
    patch: Partial<ItemProfileRecord>
  ) {
    if (patch.nsn) await ensureNsnUnique(teamId, patch.nsn, id);
    const current = await doc.send(
      new GetCommand({ TableName: DDB_TABLE, Key: { PK: pk(teamId), SK: sk(id) } })
    );
    const existing = fromDb(current.Item);
    if (!existing) throw new Error("Not found");
    const { id: _i, teamId: _t, createdAt: _ca, createdBy: _cb, ...mutable } =
      patch as any;
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
  async softDelete(teamId: string, id: string) {
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
        ConditionExpression:
          "attribute_exists(PK) AND attribute_exists(SK) AND attribute_not_exists(deletedAt)",
      })
    );
    return { id };
  },
  async hardDelete(teamId: string, id: string) {
    await doc.send(
      new DeleteCommand({
        TableName: DDB_TABLE,
        Key: { PK: pk(teamId), SK: sk(id) },
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
      })
    );
    return { id };
  },
  async getById(teamId: string, id: string) {
    const res = await doc.send(
      new GetCommand({ TableName: DDB_TABLE, Key: { PK: pk(teamId), SK: sk(id) } })
    );
    return fromDb(res.Item) ?? null;
  },
  async list(teamId: string, args: z.infer<typeof ListItemProfilesInput>) {
    let ExclusiveStartKey: any | undefined;
    if (args.cursor) {
      try {
        ExclusiveStartKey = JSON.parse(
          Buffer.from(args.cursor, "base64").toString("utf-8")
        );
      } catch {
        ExclusiveStartKey = undefined;
      }
    }
    if (args.parentItemId) {
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
      const items = (res.Items ?? [])
        .map(fromDb)
        .filter(Boolean) as ItemProfileRecord[];
      const nextCursor = res.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(res.LastEvaluatedKey), "utf-8").toString(
            "base64"
          )
        : undefined;
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
    let items = (res.Items ?? [])
      .map(fromDb)
      .filter(Boolean) as ItemProfileRecord[];
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
    items.sort((a, b) => {
      let cmp = 0;
      if (args.orderBy === "name") cmp = a.name.localeCompare(b.name);
      else if (args.orderBy === "createdAt")
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
      else cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      return args.order === "asc" ? cmp : -cmp;
    });
    const nextCursor = res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey), "utf-8").toString(
          "base64"
        )
      : undefined;
    return { items, nextCursor };
  },
};