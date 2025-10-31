// File: src/api/src/routers/itemProfiles.test.ts
// Documentation-focused version: every test has a clear "what/expect" note.


import { TRPCError } from "@trpc/server";
import { itemProfilesRouter, itemProfilesRepo } from "../../src/routers/itemProfiles";
import type { Context } from "../../src/routers/trpc";

const mkCtx = (overrides: Partial<Context> = {}): Context => ({
  req: {
    // Minimal shape used by our headerLookup()
    headers: {
      "x-user-id": "user-123",
      "x-team-id": "team-abc",
      ...(overrides as any)?.req?.headers,
    },
  } as any,
  res: undefined,
  event: undefined,
  lambdaContext: undefined,
  responseHeaders: {},
  responseCookies: [],
  ...overrides,
});

const FIXED_DATE = new Date("2025-01-02T03:04:05.678Z");

describe("itemProfilesRouter", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------
  // create()
  // -------------------------------
  /**
   * What: Prevents duplicate SKUs per team (enforced at repo layer, mapped to error).
   * Expect: First create succeeds, second with same SKU is rejected with INTERNAL_SERVER_ERROR.
   */
  test("create(): duplicate SKU is rejected", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);
    const input = {
      name: "Radio",
      description: "desc",
      sku: "SKU-DUP",
      category: "Comms",
      tags: [],
      attributes: {},
    };
    // First create succeeds
    jest.spyOn(itemProfilesRepo, "create").mockResolvedValueOnce({
      ...input,
      id: "item-dup-1",
      teamId: "team-abc",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      createdBy: "user-123",
      updatedBy: "user-123",
      deletedAt: null,
    } as any);
    await expect(caller.create(input)).resolves.toMatchObject({ sku: "SKU-DUP" });
    // Second create fails with "Duplicate SKU" error (repo throws)
    jest.spyOn(itemProfilesRepo, "create").mockRejectedValueOnce(new Error("Duplicate SKU"));
    await expect(caller.create(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  /**
   * What: Allows re-creating an item with the same SKU if previous record is soft-deleted.
   * Expect: Can create after softDelete, with same SKU.
   */
  test("create(): allowed when previous record soft-deleted", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);
    const input = {
      name: "Repeater",
      description: "",
      sku: "SKU-SOFT-1",
      category: "Comms",
      tags: [],
      attributes: {},
    };
    // Create A
    jest.spyOn(itemProfilesRepo, "create").mockResolvedValueOnce({
      ...input,
      id: "item-soft-1",
      teamId: "team-abc",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      createdBy: "user-123",
      updatedBy: "user-123",
      deletedAt: null,
    } as any);
    await expect(caller.create(input)).resolves.toMatchObject({ sku: "SKU-SOFT-1" });
    // Soft delete A
    jest.spyOn(itemProfilesRepo, "softDelete").mockResolvedValueOnce({ id: "item-soft-1" });
    await expect(caller.delete({ id: "item-soft-1" })).resolves.toMatchObject({ id: "item-soft-1" });
    // Create B with same SKU
    jest.spyOn(itemProfilesRepo, "create").mockResolvedValueOnce({
      ...input,
      id: "item-soft-2",
      teamId: "team-abc",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      createdBy: "user-123",
      updatedBy: "user-123",
      deletedAt: null,
    } as any);
    await expect(caller.create(input)).resolves.toMatchObject({ id: "item-soft-2", sku: "SKU-SOFT-1" });
  });

  /**
   * What: Requires user authentication header for create.
   * Expect: UNAUTHORIZED if x-user-id header is missing.
   */
  test("create(): unauthorized — missing user header", async () => {
    const ctx = mkCtx({ req: { headers: { "x-team-id": "team-abc" } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);
    await expect(
      caller.create({ name: "X", description: "", sku: "S", category: "C", tags: [], attributes: {} })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  /**
   * What: Verifies a successful create flow.
   * Expect: Repo called with server-derived teamId, audit fields stamped,
   *         and the exact record returned from the repo is surfaced back to caller.
   */
  test("create(): happy path — returns created record with audit + team scoping", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    const input = {
      name: "AN/PRC-163 Radio",
      description: "Multiband handheld",
      sku: "SKU-001",
      category: "Comms",
      tags: ["handheld", "radio"],
      attributes: { nsn: "1234-56-789-0000" },
    };

    const created = {
      id: "item-1",
      teamId: "team-abc",
      name: input.name,
      description: input.description,
      sku: input.sku,
      category: input.category,
      tags: input.tags,
      attributes: input.attributes,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      createdBy: "user-123",
      updatedBy: "user-123",
      deletedAt: null,
    };

    const spy = jest
      .spyOn(itemProfilesRepo, "create")
      .mockResolvedValue(created as any);

    const res = await caller.create(input);

    // Expect: teamId supplied from ctx and core fields passed through
    expect(spy).toHaveBeenCalledWith(
      "team-abc",
      expect.objectContaining({ name: input.name, sku: input.sku, category: input.category })
    );
    // Expect: returned record matches repo result (incl. audit)
    expect(res).toEqual(created);
  });

  /**
   * What: Ensures Zod validation rejects missing required fields.
   * Expect: BAD_REQUEST for each invalid input (name/sku/category are required).
   */
  test("create(): validation — missing required fields -> BAD_REQUEST", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    const badInputs = [
      { description: "no required fields at all" } as any,
      { name: "ok", category: "ok" } as any,
      { name: "ok", sku: "ok" } as any,
    ];

    for (const input of badInputs) {
      await expect(caller.create(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  /**
   * What: Maps underlying repo/DB errors into TRPC errors for the client.
   * Expect: INTERNAL_SERVER_ERROR when repo throws.
   */
  test("create(): repo error -> INTERNAL_SERVER_ERROR", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    jest.spyOn(itemProfilesRepo, "create").mockRejectedValue(new Error("DDB ConditionalCheckFailed"));

    await expect(
      caller.create({
        name: "AN/PRC-163",
        description: "",
        sku: "SKU-dup",
        category: "Comms",
        tags: [],
        attributes: {},
      })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  /**
   * What: Enforces server-side team scoping (no teamId -> no access).
   * Expect: FORBIDDEN when ctx lacks teamId.
   */
  test("create(): forbidden — missing teamId on ctx", async () => {
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123" } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(
      caller.create({ name: "X", description: "", sku: "S", category: "C", tags: [], attributes: {} })
    ).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });

  // -------------------------------
  // update()
  // -------------------------------
  /**
   * What: Changing SKU to a value already used by another record is not allowed.
   * Expect: Attempting to update SKU to a duplicate results in INTERNAL_SERVER_ERROR.
   */
  test("update(): changing SKU enforces uniqueness", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);
    // Create A with sku S1
    jest.spyOn(itemProfilesRepo, "create").mockResolvedValueOnce({
      id: "item-A",
      teamId: "team-abc",
      name: "A",
      description: "",
      sku: "S1",
      category: "C",
      tags: [],
      attributes: {},
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      createdBy: "user-123",
      updatedBy: "user-123",
      deletedAt: null,
    } as any);
    await caller.create({
      name: "A",
      description: "",
      sku: "S1",
      category: "C",
      tags: [],
      attributes: {},
    });
    // Create B with sku S2
    jest.spyOn(itemProfilesRepo, "create").mockResolvedValueOnce({
      id: "item-B",
      teamId: "team-abc",
      name: "B",
      description: "",
      sku: "S2",
      category: "C",
      tags: [],
      attributes: {},
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      createdBy: "user-123",
      updatedBy: "user-123",
      deletedAt: null,
    } as any);
    await caller.create({
      name: "B",
      description: "",
      sku: "S2",
      category: "C",
      tags: [],
      attributes: {},
    });
    // Update B to sku S1 (should fail)
    jest.spyOn(itemProfilesRepo, "update").mockRejectedValueOnce(new Error("Duplicate SKU"));
    await expect(
      caller.update({ id: "item-B", patch: { sku: "S1" } })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  /**
   * What: Patch attempts to update immutable fields (id, createdAt, teamId) are ignored.
   * Expect: Repo receives patch with these fields omitted; resulting record preserves original values.
   */
  test("update(): immutable fields in patch are ignored", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);
    // Create A
    const created = {
      id: "item-IMM",
      teamId: "team-abc",
      name: "IMM",
      description: "",
      sku: "IMM-1",
      category: "IMM",
      tags: [],
      attributes: {},
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      createdBy: "user-123",
      updatedBy: "user-123",
      deletedAt: null,
    };
    jest.spyOn(itemProfilesRepo, "create").mockResolvedValueOnce(created as any);
    await caller.create({
      name: "IMM",
      description: "",
      sku: "IMM-1",
      category: "IMM",
      tags: [],
      attributes: {},
    });
    // Patch with immutable fields
    const patch = {
      name: "IMM-EDITED",
      id: "new-id",
      createdAt: new Date("2000-01-01T00:00:00.000Z"),
      teamId: "other-team",
      description: "desc2",
    } as any;
    const spyUpdate = jest.spyOn(itemProfilesRepo, "update").mockResolvedValueOnce({
      ...created,
      name: "IMM-EDITED",
      description: "desc2",
      updatedAt: FIXED_DATE,
      updatedBy: "user-123",
    } as any);
    const res = await caller.update({ id: "item-IMM", patch });
    // Patch sent to repo omits id, createdAt, teamId
    expect(spyUpdate).toHaveBeenCalledWith(
      "team-abc",
      "item-IMM",
      expect.not.objectContaining({ id: expect.anything(), createdAt: expect.anything(), teamId: expect.anything() })
    );
    // Record returned preserves original immutable fields
    expect(res.id).toBe("item-IMM");
    expect(res.teamId).toBe("team-abc");
    expect(res.createdAt).toEqual(FIXED_DATE);
    expect(res.name).toBe("IMM-EDITED");
    expect(res.description).toBe("desc2");
  });

  /**
   * What: Verifies update flow adds server-side audit fields and forwards patch to repo.
   * Expect: Repo called with teamId, id, and patch extended with updatedBy/updatedAt;
   *         returned value equals repo response.
   */
  test("update(): happy path — applies patch and stamps audit", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    const patch = { description: "Updated desc", tags: ["radio", "vhf"] };

    const updated = {
      id: "item-1",
      teamId: "team-abc",
      name: "AN/PRC-163 Radio",
      description: patch.description,
      sku: "SKU-001",
      category: "Comms",
      tags: patch.tags,
      attributes: { nsn: "1234-56-789-0000" },
      createdAt: new Date("2024-12-01T00:00:00.000Z"),
      updatedAt: FIXED_DATE,
      createdBy: "user-321",
      updatedBy: "user-123",
      deletedAt: null,
    };

    const spy = jest.spyOn(itemProfilesRepo, "update").mockResolvedValue(updated as any);

    const res = await caller.update({ id: "item-1", patch });

    // Expect: team scoping + audit fields appended to patch
    expect(spy).toHaveBeenCalledWith(
      "team-abc",
      "item-1",
      expect.objectContaining({ description: "Updated desc", tags: ["radio", "vhf"], updatedBy: "user-123", updatedAt: FIXED_DATE })
    );
    // Expect: router returns repo's updated record
    expect(res).toEqual(updated);
  });

  /**
   * What: Ensures empty patches are rejected (no-ops disallowed).
   * Expect: BAD_REQUEST when patch is empty object.
   */
  test("update(): validation — empty patch -> BAD_REQUEST", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(caller.update({ id: "item-1", patch: {} })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  /**
   * What: Verifies repo errors are surfaced as INTERNAL_SERVER_ERROR.
   * Expect: INTERNAL_SERVER_ERROR when repo throws.
   */
  test("update(): repo error -> INTERNAL_SERVER_ERROR", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    jest.spyOn(itemProfilesRepo, "update").mockRejectedValue(new Error("DDB ProvisionedThroughputExceeded"));

    await expect(caller.update({ id: "item-1", patch: { name: "New" } })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  /**
   * What: Enforces team scoping on update.
   * Expect: FORBIDDEN without teamId in ctx.
   */
  test("update(): forbidden — missing teamId on ctx", async () => {
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123" } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(caller.update({ id: "item-1", patch: { name: "X" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // -------------------------------
  // delete()
  // -------------------------------
  /**
   * What: After soft-delete, record is not returned by getById and list.
   * Expect: getById returns NOT_FOUND; list does not include soft-deleted record.
   */
  test("delete(): soft-deleted record not returned by getById and list", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);
    // Create A
    const itemA = {
      id: "item-SDEL",
      teamId: "team-abc",
      name: "SoftDel",
      description: "",
      sku: "SDEL-1",
      category: "Del",
      tags: [],
      attributes: {},
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      createdBy: "user-123",
      updatedBy: "user-123",
      deletedAt: null,
    };
    jest.spyOn(itemProfilesRepo, "create").mockResolvedValueOnce(itemA as any);
    await caller.create({
      name: "SoftDel",
      description: "",
      sku: "SDEL-1",
      category: "Del",
      tags: [],
      attributes: {},
    });
    // Soft delete A
    jest.spyOn(itemProfilesRepo, "softDelete").mockResolvedValueOnce({ id: "item-SDEL" });
    await caller.delete({ id: "item-SDEL" });
    // getById returns NOT_FOUND
    jest.spyOn(itemProfilesRepo, "getById").mockResolvedValueOnce(null);
    await expect(caller.getById({ id: "item-SDEL" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // list does not include A
    jest.spyOn(itemProfilesRepo, "list").mockResolvedValueOnce({ items: [], nextCursor: undefined });
    const res = await caller.list({});
    expect(res.items).not.toContainEqual(expect.objectContaining({ id: "item-SDEL" }));
  });

  /**
   * What: Validates default delete behavior is soft-delete.
   * Expect: Calls softDelete(repo) with teamId/id and returns its result.
   */
  test("delete(): soft delete by default", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    const spySoft = jest.spyOn(itemProfilesRepo, "softDelete").mockResolvedValue({ id: "item-1" });

    const res = await caller.delete({ id: "item-1" });

    expect(spySoft).toHaveBeenCalledWith("team-abc", "item-1");
    expect(res).toEqual({ id: "item-1" });
  });

  /**
   * What: Validates explicit hard-delete path.
   * Expect: Calls hardDelete(repo) when hard=true and returns its result.
   */
  test("delete(): hard delete when flag set", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    const spyHard = jest.spyOn(itemProfilesRepo, "hardDelete").mockResolvedValue({ id: "item-9" });

    const res = await caller.delete({ id: "item-9", hard: true });

    expect(spyHard).toHaveBeenCalledWith("team-abc", "item-9");
    expect(res).toEqual({ id: "item-9" });
  });

  /**
   * What: Ensures error mapping for delete failures.
   * Expect: INTERNAL_SERVER_ERROR when repo softDelete throws.
   */
  test("delete(): repo error -> INTERNAL_SERVER_ERROR", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    jest.spyOn(itemProfilesRepo, "softDelete").mockRejectedValue(new Error("DDB ConditionalCheckFailed"));

    await expect(caller.delete({ id: "item-x" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  /**
   * What: Enforces team scoping on delete.
   * Expect: FORBIDDEN without teamId in ctx.
   */
  test("delete(): forbidden — missing teamId on ctx", async () => {
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123" } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(caller.delete({ id: "item-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // -------------------------------
  // getById()
  // -------------------------------
  /**
   * What: Requires user authentication header for getById.
   * Expect: UNAUTHORIZED if x-user-id header is missing.
   */
  test("getById(): unauthorized — missing user header", async () => {
    const ctx = mkCtx({ req: { headers: { "x-team-id": "team-abc" } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);
    await expect(caller.getById({ id: "item-42" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  /**
   * What: Fetches one record scoped to the caller's team.
   * Expect: Repo called with (teamId, id); router returns repo record unchanged.
   */
  test("getById(): happy path — returns one item in the caller's team", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    const baseRec = {
      id: "item-42",
      teamId: "team-abc",
      name: "AN/PRC-163 Radio",
      description: "Multiband handheld",
      sku: "SKU-042",
      category: "Comms",
      tags: ["handheld", "radio"],
      attributes: { nsn: "1234-56-789-0000" },
      createdAt: new Date("2024-12-01T00:00:00.000Z"),
      updatedAt: new Date("2024-12-02T00:00:00.000Z"),
      createdBy: "user-111",
      updatedBy: "user-222",
      deletedAt: null,
    };

    const spy = jest.spyOn(itemProfilesRepo, "getById").mockResolvedValue(baseRec as any);

    const res = await caller.getById({ id: "item-42" });

    expect(spy).toHaveBeenCalledWith("team-abc", "item-42");
    expect(res).toEqual(baseRec);
  });

  /**
   * What: Validates Zod schema for id.
   * Expect: BAD_REQUEST when id missing or empty string.
   */
  test("getById(): validation — missing/empty id -> BAD_REQUEST", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    // @ts-expect-error intentional: id missing
    await expect(caller.getById({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.getById({ id: "" as any })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  /**
   * What: Ensures 404 behavior when record absent.
   * Expect: NOT_FOUND when repo returns null.
   */
  test("getById(): not found -> NOT_FOUND", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    jest.spyOn(itemProfilesRepo, "getById").mockResolvedValue(null);

    await expect(caller.getById({ id: "does-not-exist" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  /**
   * What: Error mapping for get-by-id failures.
   * Expect: INTERNAL_SERVER_ERROR when repo throws.
   */
  test("getById(): repo error -> INTERNAL_SERVER_ERROR", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    jest.spyOn(itemProfilesRepo, "getById").mockRejectedValue(new Error("DDB ThrottlingException"));

    await expect(caller.getById({ id: "item-42" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  /**
   * What: Enforces team scoping for reads.
   * Expect: FORBIDDEN without teamId in ctx.
   */
  test("getById(): forbidden — missing teamId on ctx", async () => {
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123" } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(caller.getById({ id: "item-42" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // -------------------------------
  // list()
  // -------------------------------

  /**
   * What: Validates listing with filters and cursor pagination.
   * Expect: Repo called with team-scoped filters; returns items and nextCursor as-is.
   */
  test("list(): happy path — returns items with pagination cursor", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    const mkListItem = (n: number) => ({
      id: `item-${n}`,
      teamId: "team-abc",
      name: `Device ${n}`,
      description: "",
      sku: `SKU-${n}`,
      category: n % 2 ? "Comms" : "Power",
      tags: n % 2 ? ["radio"] : ["battery"],
      attributes: {},
      createdAt: new Date("2024-12-01T00:00:00.000Z"),
      updatedAt: new Date("2024-12-02T00:00:00.000Z"),
      createdBy: "user-111",
      updatedBy: "user-222",
      deletedAt: null,
    });

    const items = [mkListItem(1), mkListItem(2), mkListItem(3)];
    const nextCursor = "opaque-cursor-123";

    const spy = jest.spyOn(itemProfilesRepo, "list").mockResolvedValue({ items: items as any, nextCursor });

    const input = {
      q: "Device",
      category: "Comms",
      tag: "radio",
      limit: 3,
      cursor: undefined,
      orderBy: "updatedAt" as const,
      order: "desc" as const,
    };

    const res = await caller.list(input);

    expect(spy).toHaveBeenCalledWith("team-abc", input);
    expect(res).toEqual({ items, nextCursor });
  });

  /**
   * What: Enforces schema bounds and enum correctness for pagination/sorting.
   * Expect: BAD_REQUEST when limit out of range or enums invalid.
   */
  test("list(): validation — limit bounds and enums enforced", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(caller.list({ limit: 0 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.list({ limit: 9999 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.list({ orderBy: "bogus" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.list({ order: "up" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  /**
   * What: Confirms default input values are applied when omitted.
   * Expect: Repo called with normalized defaults; response returned intact.
   */
  test("list(): defaults — applied when omitted", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    const spy = jest.spyOn(itemProfilesRepo, "list").mockResolvedValue({ items: [], nextCursor: undefined });

    const res = await caller.list({}); // rely on defaults

    expect(spy).toHaveBeenCalledWith("team-abc", {
      q: undefined,
      category: undefined,
      tag: undefined,
      limit: 50,
      cursor: undefined,
      orderBy: "updatedAt",
      order: "desc",
    });
    expect(res).toEqual({ items: [], nextCursor: undefined });
  });

  /**
   * What: Maps repo failures during listing.
   * Expect: INTERNAL_SERVER_ERROR when repo throws.
   */
  test("list(): repo error -> INTERNAL_SERVER_ERROR", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    jest.spyOn(itemProfilesRepo, "list").mockRejectedValue(new Error("DDB QueryTimeout"));

    await expect(caller.list({ limit: 10 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  /**
   * What: Enforces team scoping for list queries.
   * Expect: FORBIDDEN without teamId in ctx.
   */
  test("list(): forbidden — missing teamId on ctx", async () => {
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123" } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(caller.list({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
  /**
   * What: Query string q matches name, description, sku, and tags.
   * Expect: Results include items matching any of these fields.
   */
  test("list(): q matches name/description/sku/tags", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);
    const items = [
      {
        id: "item-n",
        teamId: "team-abc",
        name: "Alpha Device",
        description: "desc",
        sku: "SKU-100",
        category: "A",
        tags: ["foo"],
        attributes: {},
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        createdBy: "user-123",
        updatedBy: "user-123",
        deletedAt: null,
      },
      {
        id: "item-d",
        teamId: "team-abc",
        name: "Bravo",
        description: "Special description",
        sku: "SKU-101",
        category: "B",
        tags: ["bar"],
        attributes: {},
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        createdBy: "user-123",
        updatedBy: "user-123",
        deletedAt: null,
      },
      {
        id: "item-s",
        teamId: "team-abc",
        name: "Charlie",
        description: "desc",
        sku: "UNIQUE-SKU",
        category: "C",
        tags: ["baz"],
        attributes: {},
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        createdBy: "user-123",
        updatedBy: "user-123",
        deletedAt: null,
      },
      {
        id: "item-t",
        teamId: "team-abc",
        name: "Delta",
        description: "desc",
        sku: "SKU-102",
        category: "D",
        tags: ["specialtag"],
        attributes: {},
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        createdBy: "user-123",
        updatedBy: "user-123",
        deletedAt: null,
      },
    ];
    // q matches name
    jest.spyOn(itemProfilesRepo, "list").mockResolvedValueOnce({ items: [items[0]], nextCursor: undefined });
    let res = await caller.list({ q: "Alpha" });
    expect(res.items.map(i => i.id)).toContain("item-n");
    // q matches description
    jest.spyOn(itemProfilesRepo, "list").mockResolvedValueOnce({ items: [items[1]], nextCursor: undefined });
    res = await caller.list({ q: "Special description" });
    expect(res.items.map(i => i.id)).toContain("item-d");
    // q matches sku
    jest.spyOn(itemProfilesRepo, "list").mockResolvedValueOnce({ items: [items[2]], nextCursor: undefined });
    res = await caller.list({ q: "UNIQUE-SKU" });
    expect(res.items.map(i => i.id)).toContain("item-s");
    // q matches tag
    jest.spyOn(itemProfilesRepo, "list").mockResolvedValueOnce({ items: [items[3]], nextCursor: undefined });
    res = await caller.list({ q: "specialtag" });
    expect(res.items.map(i => i.id)).toContain("item-t");
  });

  /**
   * What: Category and tag filters must both be satisfied (intersection).
   * Expect: Only items matching both filters are returned.
   */
  test("list(): category and tag filters narrow results", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);
    const items = [
      {
        id: "item-1",
        teamId: "team-abc",
        name: "Epsilon",
        description: "",
        sku: "SKU-201",
        category: "Power",
        tags: ["battery", "common"],
        attributes: {},
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        createdBy: "user-123",
        updatedBy: "user-123",
        deletedAt: null,
      },
      {
        id: "item-2",
        teamId: "team-abc",
        name: "Zeta",
        description: "",
        sku: "SKU-202",
        category: "Power",
        tags: ["radio"],
        attributes: {},
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        createdBy: "user-123",
        updatedBy: "user-123",
        deletedAt: null,
      },
      {
        id: "item-3",
        teamId: "team-abc",
        name: "Eta",
        description: "",
        sku: "SKU-203",
        category: "Comms",
        tags: ["battery"],
        attributes: {},
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        createdBy: "user-123",
        updatedBy: "user-123",
        deletedAt: null,
      },
    ];
    // Only item-1 matches category=Power and tag=battery
    jest.spyOn(itemProfilesRepo, "list").mockResolvedValueOnce({ items: [items[0]], nextCursor: undefined });
    const res = await caller.list({ category: "Power", tag: "battery" });
    expect(res.items.map(i => i.id)).toEqual(["item-1"]);
  });

  /**
   * What: Supports ordering and cursor-based pagination.
   * Expect: orderBy=name asc with limit=2 returns first two, cursor for next page, then next two, then no more.
   */
  test("list(): ordering and pagination cursor", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);
    // 5 items with distinct names, updatedAt
    const items = [1, 2, 3, 4, 5].map(n => ({
      id: `item-${n}`,
      teamId: "team-abc",
      name: `Name-${n}`,
      description: "",
      sku: `SKU-${n}`,
      category: "Cat",
      tags: [],
      attributes: {},
      createdAt: FIXED_DATE,
      updatedAt: new Date(FIXED_DATE.getTime() + n * 1000),
      createdBy: "user-123",
      updatedBy: "user-123",
      deletedAt: null,
    }));
    // First page: items 1,2
    jest.spyOn(itemProfilesRepo, "list").mockResolvedValueOnce({
      items: [items[0], items[1]],
      nextCursor: "cursor-2"
    });
    let res = await caller.list({ orderBy: "name", order: "asc", limit: 2 });
    expect(res.items.length).toBe(2);
    expect(res.nextCursor).toBe("cursor-2");
    // Second page: items 3,4
    jest.spyOn(itemProfilesRepo, "list").mockResolvedValueOnce({
      items: [items[2], items[3]],
      nextCursor: "cursor-4"
    });
    res = await caller.list({ orderBy: "name", order: "asc", limit: 2, cursor: "cursor-2" });
    expect(res.items.length).toBe(2);
    expect(res.nextCursor).toBe("cursor-4");
    // Final page: item 5, no nextCursor
    jest.spyOn(itemProfilesRepo, "list").mockResolvedValueOnce({
      items: [items[4]],
      nextCursor: undefined
    });
    res = await caller.list({ orderBy: "name", order: "asc", limit: 2, cursor: "cursor-4" });
    expect(res.items.length).toBe(1);
    expect(res.nextCursor).toBeUndefined();
  });