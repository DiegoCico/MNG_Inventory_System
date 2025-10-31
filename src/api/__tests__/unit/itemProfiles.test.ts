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
   * What: Verifies a successful create flow.
   * Expect: Repo called with server-derived teamId, audit fields stamped,
   *         and the exact record returned from the repo is surfaced back to caller.
   */
  test("create(): happy path — returns created record with audit + team scoping", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

        const input = {
            nsn: "NSN-001",
            name: "AN/PRC-163 Radio",
            description: "Multiband handheld",
        };

    const created = {
        id: "item-1",
        teamId: "team-abc",
        nsn: input.nsn,
        name: input.name,
        description: input.description,
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
      expect.objectContaining({ name: input.name, nsn: input.nsn })
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
      { name: "ok" } as any,          // missing nsn
      { nsn: "NSN-OK" } as any,       // missing name
    ];

    for (const input of badInputs) {
      await expect(
        caller.create(input)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
        nsn: "NSN-dup",
        name: "AN/PRC-163",
        description: "",
      })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  /**
   * What: Enforces server-side team scoping (no teamId -> no access).
   * Expect: FORBIDDEN when ctx lacks teamId.
   */
  test("create(): forbidden — missing teamId on ctx", async () => {
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123", "x-team-id": undefined } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(
      caller.create({ nsn: "NSN-X", name: "X", description: "" })
    ).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });

  // -------------------------------
  // update()
  // -------------------------------

  /**
   * What: Verifies update flow adds server-side audit fields and forwards patch to repo.
   * Expect: Repo called with teamId, id, and patch extended with updatedBy/updatedAt;
   *         returned value equals repo response.
   */
  test("update(): happy path — applies patch and stamps audit", async () => {
    const ctx = mkCtx();
    const caller = itemProfilesRouter.createCaller(ctx);

    const patch = { description: "Updated desc" };

    const updated = {
      id: "item-1",
      teamId: "team-abc",
      nsn: "NSN-001",
      name: "AN/PRC-163 Radio",
      description: patch.description,
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
      expect.objectContaining({ description: "Updated desc", updatedBy: "user-123", updatedAt: FIXED_DATE })
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
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123", "x-team-id": undefined } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(caller.update({ id: "item-1", patch: { name: "X" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // -------------------------------
  // delete()
  // -------------------------------

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
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123", "x-team-id": undefined } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(caller.delete({ id: "item-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // -------------------------------
  // getById()
  // -------------------------------

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
      nsn: "1234-56-789-0000",
      name: "AN/PRC-163 Radio",
      description: "Multiband handheld",
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
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123", "x-team-id": undefined } } as any });
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
      nsn: `NSN-${n}`,
      name: `Device ${n}`,
      description: "",
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
      parentItemId: undefined,
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
    const ctx = mkCtx({ req: { headers: { "x-user-id": "user-123", "x-team-id": undefined } } as any });
    const caller = itemProfilesRouter.createCaller(ctx);

    await expect(caller.list({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});