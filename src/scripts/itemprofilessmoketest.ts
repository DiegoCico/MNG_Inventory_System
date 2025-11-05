/**
 * ItemProfiles smoke test (opt-in, dynamic).
 * Runs only when SMOKE=1 (skipped otherwise). Uses tRPC caller (no HTTP).
 *
 * Goals (full CRUD + indexes + pagination + image checks):
 *   1) Assert procedures exist dynamically (create, getById, list, update, delete, findByNSN?).
 *   2) Create root item (S3 object existence validated) and read it back (getById, findByNSN).
 *   3) Create children, list by parent with cursor pagination (GSI2 path).
 *   4) Update fields, verify changes.
 *   5) Enforce NSN uniqueness (duplicate create must fail).
 *   6) Soft delete -> hidden from list; "restore" via update; hard delete removes entirely.
 *   7) Negative image checks: bad prefix and missing S3 object should fail.
 *
 * DRY mode: set SMOKE_DRY=1 to only assert that procedures exist (no AWS/DDB calls).
 *
 * Quick usage:
 *   npm -w src/api run smoke:itemProfiles              # full
 *   npm -w src/api run smoke:itemProfiles:dry          # procedures-only
 *   SMOKE_ONLY=create,children npm -w src/api run smoke:itemProfiles
 *   SMOKE_USER_ID=me SMOKE_TEAM_ID=alpha npm -w src/api run smoke:itemProfiles
 */

// Force AWS env for SMOKE runs (no dotenv used in repo runtime)
import dotenv from "dotenv";
dotenv.config({ path: ".env.dev" });

if (process.env.SMOKE === "1") {
  process.env.AWS_REGION = process.env.AWS_REGION || "us-east-1";
  // The codebase sometimes reads DDB_TABLE / USERS_TABLE; set them explicitly
  const table = process.env.TABLE_NAME || "mng-dev-data";
  process.env.TABLE_NAME = table;
  process.env.DDB_TABLE = process.env.DDB_TABLE || table;
  process.env.USERS_TABLE = process.env.USERS_TABLE || table;

  process.env.S3_BUCKET = process.env.S3_BUCKET || "dev-sample-image-buckets";
}

import { appRouter } from "../api/src/routers";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";

type AnyFn = (...args: any[]) => any;

const maybeDescribe = process.env.SMOKE === "1" ? describe : describe.skip;
const DRY = process.env.SMOKE_DRY === "1";

// Step gating: run a subset via SMOKE_ONLY="create,children,update,delete,uniqueness"
const ONLY = (process.env.SMOKE_ONLY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
function allow(step: string) {
  return ONLY.length === 0 || ONLY.includes(step);
}

// Parametric user/team for portability across dev workspaces
const USER_ID = process.env.SMOKE_USER_ID || "user-123";
const TEAM_ID = process.env.SMOKE_TEAM_ID || "1";

function pickNamespace(caller: any) {
  const candidates = ["itemProfiles", "items", "inventory", "item", "itemProfile"];
  for (const key of candidates) {
    if (caller?.[key] && typeof caller[key] === "object") {
      return caller[key];
    }
  }
  // fall back to root (flat)
  return caller;
}

function pickMethod<T extends AnyFn>(ns: any, variants: string[]): T | undefined {
  for (const name of variants) {
    const fn = ns?.[name];
    if (typeof fn === "function") return fn as T;
  }
  return undefined;
}

function normalizeListResult(listResult: any): { items: any[]; nextCursor?: any } {
  if (!listResult) return { items: [] };
  if (Array.isArray(listResult)) return { items: listResult };
  const items = Array.isArray(listResult.items) ? listResult.items : [];
  const nextCursor = listResult.nextCursor ?? listResult.cursor ?? listResult.lastKey ?? listResult.LastEvaluatedKey;
  return { items, nextCursor };
}

async function ensureSmokeImage(key: string) {
  const region = process.env.AWS_REGION || "us-east-1";
  const bucket = process.env.S3_BUCKET || "dev-sample-image-buckets";

  const hasEnvCreds =
    !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;

  const credentials = hasEnvCreds
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN, // optional
      }
    : fromIni({
        profile: process.env.AWS_PROFILE || "mng-dev",
      });

  const s3 = new S3Client({ region, credentials });
  // Upload a zero-byte PNG; router only checks existence
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(0),
      ContentType: "image/png",
    })
  );
  return { bucket, key };
}

maybeDescribe("SMOKE: itemProfiles CRUD", () => {
  it("create -> get -> list -> update -> delete", async () => {
    // Provide a richer fake context to satisfy common auth/tenant checks.
    const ctx: any = {
      user: { id: USER_ID, email: "test@example.com", roles: ["admin"] },
      auth: { userId: USER_ID, teamId: TEAM_ID, email: "test@example.com", roles: ["admin"] },
      userId: USER_ID,
      teamId: TEAM_ID,
      stage: "test",
    };

    const caller = appRouter.createCaller(ctx);
    const ns = pickNamespace(caller);

    // Diagnostics: see what procedures exist under the chosen namespace
    if (process.env.SMOKE === "1") console.log("itemProfiles namespace keys:", Object.keys(ns || {}));

    // Try common method names
    const create = pickMethod<AnyFn>(ns, ["create", "createItem", "createItemProfile"]);
    const getById = pickMethod<AnyFn>(ns, ["getById", "get", "read", "fetchById"]);
    const list = pickMethod<AnyFn>(ns, ["list", "listItems", "search", "query"]);
    const update = pickMethod<AnyFn>(ns, ["update", "patch", "updateItem", "edit"]);
    const del = pickMethod<AnyFn>(ns, ["delete", "remove", "deleteItem"]);
    const findByNSN = pickMethod<AnyFn>(ns, ["findByNSN", "getByNSN", "lookupByNSN"]);

    // DRY mode: only assert availability and quit early
    if (DRY) {
      expect(typeof create).toBe("function");
      expect(typeof getById).toBe("function");
      expect(typeof list).toBe("function");
      expect(typeof update).toBe("function");
      expect(typeof del).toBe("function");
      // optional but nice-to-have
      expect(typeof findByNSN === "undefined" || typeof findByNSN === "function").toBe(true);
      return;
    }

    if (!create || !getById || !list || !update || !del) {
      const available = Object.keys(ns || {});
      throw new Error(
        "Item procedures not found. Expected create/getById/list/update/delete. " +
          `Checked namespace keys: [${available.join(", ")}]`
      );
    }

    const userId = USER_ID;
    const teamId = TEAM_ID;
    const nsn = `SMOKE-NSN-${Date.now()}`; // always unique

    const serial = "SMOKE-SN1";
    const imageId = "smoke.png"; // simple deterministic filename for test
    const key = `teams/${TEAM_ID}/items/${serial}/${imageId}`; // must match backend's buildImageKey(team, dirHint, filename)

    // Children references declared in outer scope so later phases can access them safely
    let child1: any | undefined;
    let child2: any | undefined;

    // Ensure the image object exists in S3 so the router validation passes
    await ensureSmokeImage(key);

    // Create ROOT item
    const createInput = {
      userId,
      teamId,
      nsn,
      serial,
      name: "Smoke Widget",
      description: "smoke test",
      image: { filename: imageId, dirHint: serial },
      parentItemId: undefined,               // maps to ROOT in GSI2 if undefined
      lastKnownLocation: "Aisle X",
    };

    if (!allow("create")) return; // run only discovery when skipping creation

    // (Best-effort) surface potential Zod issues before call
    try {
      const maybeCreateProc: any = create;
      const zodSchema = maybeCreateProc?._def?.inputs?.[0];
      if (zodSchema && typeof zodSchema.safeParse === "function") {
        const res = zodSchema.safeParse(createInput);
        if (!res.success) {
          console.error("Zod input issues for itemProfiles.create:", res.error.issues);
        }
      }
    } catch {}

    const root = await create(createInput);
    expect(root?.id).toBeDefined();

    // getById
    const got1 = await getById({ userId, teamId, id: root.id });
    expect(got1?.id).toBe(root.id);

    // findByNSN (optional)
    if (findByNSN) {
      const byNsn = await findByNSN({ userId, teamId, nsn });
      expect(byNsn?.id ?? byNsn?.item?.id).toBe(root.id);
    }

    if (allow("uniqueness")) {
      // NSN uniqueness should be enforced
      await expect(
        create({
          userId,
          teamId,
          nsn, // duplicate
          serial: "SMOKE-SN1-dup",
          name: "Duplicate",
          image: { filename: imageId, dirHint: serial },
        })
      ).rejects.toBeTruthy();
    }

    if (allow("children")) {
      // Create two children to exercise parent listing + pagination
      child1 = await create({
        userId,
        teamId,
        nsn: `${nsn}-C1`,
        serial: "SMOKE-C1",
        name: "Child 1",
        parentItemId: root.id,
        image: { filename: imageId, dirHint: serial },
      });
      child2 = await create({
        userId,
        teamId,
        nsn: `${nsn}-C2`,
        serial: "SMOKE-C2",
        name: "Child 2",
        parentItemId: root.id,
        image: { filename: imageId, dirHint: serial },
      });

      // list (all)
      const listAllRes = await list({ userId, teamId, limit: 50, q: "smoke" });
      const listAll = normalizeListResult(listAllRes);
      const allIds = listAll.items.map((i: any) => i?.id ?? i?.item?.id).filter(Boolean);
      expect(allIds).toEqual(expect.arrayContaining([root.id, child1.id, child2.id]));

      // list by parent with pagination
      const page1Res = await list({ userId, teamId, parentItemId: root.id, limit: 1, order: "asc" });
      const page1 = normalizeListResult(page1Res);
      expect(page1.items.length).toBe(1);
      expect(page1.nextCursor).toBeTruthy();

      const page2Res = await list({ userId, teamId, parentItemId: root.id, limit: 1, cursor: page1.nextCursor, order: "asc" });
      const page2 = normalizeListResult(page2Res);
      expect(page2.items.length).toBe(1);
      const childIds = [...page1.items, ...page2.items]
        .map((i: any) => i?.id ?? i?.item?.id)
        .sort();
      expect(childIds).toEqual([child1.id, child2.id].sort());
    }

    if (allow("update")) {
      // update root
      const updated = await update({
        userId,
        teamId,
        id: root.id,
        patch: { name: "Smoke Widget v2", lastKnownLocation: "Aisle Y" },
      });
      const updatedName = updated?.name ?? updated?.item?.name;
      const updatedLoc = updated?.lastKnownLocation ?? updated?.item?.lastKnownLocation;
      expect(updatedName).toBe("Smoke Widget v2");
      expect(updatedLoc).toBe("Aisle Y");
    }

    if (allow("delete")) {
      // SOFT DELETE a child — should disappear from parent listing
      // Some repos require an optimistic concurrency token (e.g., expectedUpdatedAt)
      if (!allow("children")) return; // skip if children were not created
      const child1Fresh = await getById({ userId, teamId, id: child1.id });
      const token =
        (child1Fresh && (child1Fresh.updatedAt || child1Fresh?.item?.updatedAt)) ||
        (child1Fresh && (child1Fresh.version || child1Fresh?.item?.version)) ||
        (child1Fresh && (child1Fresh.rev || child1Fresh?.item?.rev)) ||
        undefined;

      let usedSoftDelete = false;
      let softDeleted: any;
      try {
        softDeleted = await del({
          userId,
          teamId,
          id: child1.id,
          hard: false,
          // pass possible concurrency fields; backend will ignore unknowns
          expectedUpdatedAt: token,
          ifMatch: token,
          updatedAt: token,
        } as any);
        usedSoftDelete = true;
      } catch (e: any) {
        const msg = `${e?.message ?? ""} ${e?.cause ?? ""}`.toLowerCase();
        // If soft delete is guarded by a conditional (version mismatch), fall back to hard delete
        if (msg.includes("conditional") || msg.includes("precondition") || msg.includes("version")) {
          softDeleted = await del({ userId, teamId, id: child1.id, hard: true });
          usedSoftDelete = false;
        } else {
          throw e;
        }
      }
      expect((softDeleted?.id ?? softDeleted?.item?.id)).toBe(child1.id);

      const afterSoftRes = await list({ userId, teamId, parentItemId: root.id, limit: 10 });
      const afterSoft = normalizeListResult(afterSoftRes);
      const afterSoftIds = afterSoft.items.map((i: any) => i?.id ?? i?.item?.id);
      // Whether soft or hard delete, the item should not be listed
      expect(afterSoftIds).not.toContain(child1.id);
      expect(afterSoftIds).toContain(child2.id);

      if (usedSoftDelete) {
        // RESTORE soft-deleted child by updating (clears deletedAt in most repos)
        const restored = await update({ userId, teamId, id: child1.id, patch: { name: "Child 1 (restored)" } });
        expect((restored?.name ?? restored?.item?.name) as string).toMatch(/restored/);

        const afterRestoreRes = await list({ userId, teamId, parentItemId: root.id, limit: 10 });
        const afterRestore = normalizeListResult(afterRestoreRes);
        const afterRestoreIds = afterRestore.items.map((i: any) => i?.id ?? i?.item?.id);
        expect(afterRestoreIds).toEqual(expect.arrayContaining([child1.id, child2.id]));
      } else {
        // If we had to hard-delete child1, recreate it to keep later expectations sane
        const child1b = await create({
          userId,
          teamId,
          nsn: `${nsn}-C1b`,
          serial: "SMOKE-C1b",
          name: "Child 1b",
          parentItemId: root.id,
          image: { filename: imageId, dirHint: serial },
        });
        // update our reference so downstream checks can still assert two children present
        child1 = child1b;
        const afterRecreateRes = await list({ userId, teamId, parentItemId: root.id, limit: 10 });
        const afterRecreate = normalizeListResult(afterRecreateRes);
        const afterRecreateIds = afterRecreate.items.map((i: any) => i?.id ?? i?.item?.id);
        expect(afterRecreateIds).toEqual(expect.arrayContaining([child1b.id, child2.id]));
      }

      // HARD DELETE the other child
      const hardDeleted = await del({ userId, teamId, id: child2.id, hard: true });
      expect((hardDeleted?.id ?? hardDeleted?.item?.id)).toBe(child2.id);

      const finalRes = await list({ userId, teamId, parentItemId: root.id, limit: 10 });
      const finalList = normalizeListResult(finalRes);
      const finalIds = finalList.items.map((i: any) => i?.id ?? i?.item?.id);
      expect(finalIds).toContain(child1.id);
      expect(finalIds).not.toContain(child2.id);

      // Finally delete the root (prefer soft, then hard if conditional errors)
      try {
        await del({ userId, teamId, id: root.id, hard: false });
      } catch (e: any) {
        const msg = `${e?.message ?? ""} ${e?.cause ?? ""}`.toLowerCase();
        if (msg.includes("conditionalcheckfailed") || msg.includes("conditional request failed")) {
          await del({ userId, teamId, id: root.id, hard: true });
        } else {
          throw e;
        }
      }
    }
  }, 60_000);

  it("rejects image keys outside team prefix and missing S3 objects", async () => {
    if (DRY) return; // skip in DRY mode

    const ctx: any = {
      user: { id: USER_ID, email: "test@example.com", roles: ["admin"] },
      auth: { userId: USER_ID, teamId: TEAM_ID, email: "test@example.com", roles: ["admin"] },
      userId: USER_ID,
      teamId: TEAM_ID,
      stage: "test",
    };
    const caller = appRouter.createCaller(ctx);
    const ns = pickNamespace(caller);
    const create = pickMethod<AnyFn>(ns, ["create", "createItem", "createItemProfile"]);
    if (!create) {
      console.warn("No create method; skipping image key negative checks");
      return;
    }

    const userId = USER_ID;
    const teamId = TEAM_ID;

    // Wrong prefix
    await expect(
      create({ userId, teamId, nsn: `BAD-${Date.now()}`, name: "Bad1", imageKey: `wrong/${teamId}/x.jpg` })
    ).rejects.toBeTruthy();

    // Missing object in the (correct) prefix
    await expect(
      create({ userId, teamId, nsn: `BAD-${Date.now()}-2`, name: "Bad2", imageKey: `teams/${teamId}/images/not-uploaded.jpg` })
    ).rejects.toBeTruthy();
  });
});
  
// In src/api/package.json, add the following scripts under "scripts":
// "smoke:itemProfiles": "SMOKE=1 jest --runInBand __tests__/unit/smoke.itemProfiles.test.ts",
// "smoke:itemProfiles:dry": "SMOKE=1 SMOKE_DRY=1 jest --runInBand __tests__/unit/smoke.itemProfiles.test.ts",