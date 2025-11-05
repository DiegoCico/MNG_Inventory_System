/**
 * ItemProfiles smoke test (opt-in).
 * Runs only when SMOKE=1 (skipped otherwise).
 * Uses tRPC caller (no HTTP).
 *
 * Resilient to namespace & method names and allows DRY mode:
 *   - Set SMOKE_DRY=1 to only assert that procedures exist (no DB calls).
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

import { appRouter } from "../../../src/routers";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";

type AnyFn = (...args: any[]) => any;

const maybeDescribe = process.env.SMOKE === "1" ? describe : describe.skip;
const DRY = process.env.SMOKE_DRY === "1";

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
      // many apps expect at least user/tenant on ctx; adjust as needed
      user: { id: "user-123", email: "test@example.com", roles: ["admin"] },
      auth: { userId: "user-123", teamId: "1", email: "test@example.com", roles: ["admin"] },
      userId: "user-123",
      teamId: "1",
      stage: "test",
    };

    const caller = appRouter.createCaller(ctx);
    const ns = pickNamespace(caller);

    // Diagnostics: see what procedures exist under the chosen namespace
    // eslint-disable-next-line no-console
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
      return;
    }

    if (!create || !getById || !list || !update || !del) {
      const available = Object.keys(ns || {});
      throw new Error(
        "Item procedures not found. Expected create/getById/list/update/delete. " +
          `Checked namespace keys: [${available.join(", ")}]`
      );
    }

    const userId = "user-123";
    const teamId = "1";
    const nsn = `SMOKE-NSN-${Date.now()}`; // always unique

    const serial = "SMOKE-SN1";
    const imageId = "smoke"; // simple deterministic id for test
    const key = `teams/${teamId}/items/${serial}/${imageId}.png`;

    // Ensure the image object exists in S3 so the router validation passes
    await ensureSmokeImage(key);

    // Create (with diagnostics)
    const createInput = {
      userId,
      teamId,
      nsn,
      serial,
      name: "Smoke Widget",
      description: "smoke test",
      imageKey: key,                         // ensureImageObjectExists will validate this
      parentItemId: undefined,               // maps to ROOT in GSI2 if undefined
      lastKnownLocation: "Aisle X",
    };

    // If available, ask the procedure's Zod input what it expects and print any issues early
    try {
      const maybeCreateProc: any = create;
      const zodSchema = maybeCreateProc?._def?.inputs?.[0];
      if (zodSchema && typeof zodSchema.safeParse === "function") {
        const res = zodSchema.safeParse(createInput);
        if (!res.success) {
          // Surface Zod issues inline to make failures actionable
          // (Do not throw here; we still attempt the call to preserve previous behavior)
          // eslint-disable-next-line no-console
          console.error("Zod input issues for itemProfiles.create:", res.error.issues);
        }
      }
    } catch {}

    let created: any;
    try {
      created = await create(createInput);
    } catch (e: any) {
      // Print rich diagnostics so we can see exactly why create failed
      // eslint-disable-next-line no-console
      console.error("Available namespace keys:", Object.keys(ns || {}));
      // eslint-disable-next-line no-console
      console.error("Create input used:", createInput);
      // eslint-disable-next-line no-console
      console.error("tRPC error shape:", e?.shape ?? e);
      // eslint-disable-next-line no-console
      console.error("Cause:", e?.cause ?? e?.message);
      // eslint-disable-next-line no-console
      console.error("Env(TABLE_NAME/DDB_TABLE/USERS_TABLE):", process.env.TABLE_NAME, process.env.DDB_TABLE, process.env.USERS_TABLE);
      throw e;
    }
    expect(created?.id).toBeDefined();

    // Get
    const fetched = await getById({ userId, teamId, id: created.id });
    expect(fetched?.id).toBe(created.id);

    // Optional findByNSN
    if (findByNSN) {
      const byNsn = await findByNSN({ userId, teamId, nsn });
      expect(byNsn?.id).toBeDefined();
    }

    // List
    const listed = await list({ userId, teamId, limit: 10, q: "smoke" });
    const items = Array.isArray(listed) ? listed : listed?.items ?? [];
    expect(Array.isArray(items)).toBe(true);

    // Update
    const updated = await update({
      userId,
      teamId,
      id: created.id,
      patch: { name: "Smoke Widget v2" },
    });
    expect(updated?.name ?? updated?.item?.name).toBe("Smoke Widget v2");

    // Delete: prefer soft-delete; if Dynamo condition fails (wrapped or raw), fallback to hard-delete
    let deleted: any;
    try {
      deleted = await del({ userId, teamId, id: created.id, hard: false });
    } catch (e: any) {
      const msg = `${e?.message ?? ""} ${e?.cause ?? ""}`.toLowerCase();
      const isConditional =
        msg.includes("conditionalcheckfailed") ||
        msg.includes("conditional request failed");
      if (isConditional) {
        deleted = await del({ userId, teamId, id: created.id, hard: true });
      } else {
        throw e;
      }
    }
    expect(deleted?.id ?? deleted?.item?.id).toBe(created.id);
  }, 60_000);
});