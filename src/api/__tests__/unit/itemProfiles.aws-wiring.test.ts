// Ensure env is present before the router module loads (it reads at import-time)
process.env.DDB_TABLE = process.env.DDB_TABLE ?? "mng-dev-data";
process.env.S3_BUCKET = process.env.S3_BUCKET ?? "mng-dev-assets";
process.env.AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
import { TRPCError } from "@trpc/server";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

import { router as mkRouter } from "../../src/routers/trpc";
import { itemProfilesRouter } from "../../src/routers/itemProfiles";
import { doc, s3Client } from "../../src/aws";

const appRouter = mkRouter({ itemProfiles: itemProfilesRouter });

function ctx(headers: Record<string, string>, params?: Record<string, string>) {
  return {
    req: { headers, params: params ?? {} } as any,
    res: {} as any,
    responseHeaders: {},
    responseCookies: [],
  };
}

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("itemProfiles AWS wiring", () => {
  test("create() -> S3 HeadObject + DDB Query (NSN GSI) + Put", async () => {
    const caller = appRouter.createCaller(
      ctx({ "x-user-id": "u1" }, { workspaceId: "team-abc" })
    );

    // S3: image exists
    const s3Spy = jest.spyOn(s3Client, "send").mockImplementation(async (cmd: any) => {
      expect(cmd).toBeInstanceOf(HeadObjectCommand);
      // validate bucket/key presence
      expect((cmd as HeadObjectCommand).input.Bucket).toBe("mng-dev-assets");
      expect(String((cmd as HeadObjectCommand).input.Key)).toMatch(/^teams\/team-abc\//);
      return {} as any;
    });

    // DDB: uniqueness query returns empty (no duplicates) + Put writes GSIs
    const ddbSpy = jest.spyOn(doc, "send").mockImplementation(async (cmd: any) => {
      if (cmd instanceof QueryCommand) {
        const input = cmd.input as any;
        expect(input.IndexName).toBe("GSI_ItemsByNSN");
        expect(input.KeyConditionExpression).toContain("GSI7PK");
        expect(input.KeyConditionExpression).toContain("GSI7SK");
        expect(input.ExpressionAttributeValues[":g"]).toBe("TEAM#team-abc#NSN");
        expect(input.ExpressionAttributeValues[":nsn"]).toBe("5306-01-092-5033");
        return { Items: [] } as any;
      }
      if (cmd instanceof PutCommand) {
        const { Item } = cmd.input as any;
        expect(Item.PK).toBe("TEAM#team-abc");
        expect(String(Item.SK)).toMatch(/^ITEM#/);
        expect(Item.GSI7PK).toBe("TEAM#team-abc#NSN");
        expect(Item.GSI7SK).toBe("5306-01-092-5033");
        expect(Item.GSI2PK).toBe("TEAM#team-abc#PARENT#ROOT"); // default when no parentItemId
        expect(typeof Item.createdAt).toBe("string");
        expect(typeof Item.updatedAt).toBe("string");
        return {} as any;
      }
      throw new Error("Unexpected DDB command in create()");
    });

    const rec = await caller.itemProfiles.create({
      nsn: "5306-01-092-5033",
      name: "Bolt",
      description: "Stainless",
      imageKey: "teams/team-abc/images/bolt.jpg",
    });

    expect(rec.nsn).toBe("5306-01-092-5033");
    expect(rec.teamId).toBe("team-abc");

    // ensure spies were exercised
    expect(s3Spy).toHaveBeenCalled();
    expect(ddbSpy).toHaveBeenCalled();
  });

  test("create() -> BAD_REQUEST if image missing in S3", async () => {
    const caller = appRouter.createCaller(
      ctx({ "x-user-id": "u1" }, { workspaceId: "team-abc" })
    );

    // S3: HeadObject fails
    jest.spyOn(s3Client, "send").mockImplementationOnce(async () => {
      const err = new Error("NotFound") as any;
      err.name = "NotFound";
      throw err;
    });

    await expect(
      caller.itemProfiles.create({
        nsn: "1111-22-333",
        name: "Widget",
        imageKey: "teams/team-abc/images/missing.jpg",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("update() -> S3 HeadObject when imageKey changes; DDB Get + (optional) Query + Put", async () => {
    const caller = appRouter.createCaller(
      ctx({ "x-user-id": "u1" }, { workspaceId: "team-abc" })
    );

    const nowIso = new Date().toISOString();

    const ddbSpy = jest.spyOn(doc, "send").mockImplementation(async (cmd: any) => {
      if (cmd instanceof GetCommand) {
        // existing record
        return {
          Item: {
            PK: "TEAM#team-abc",
            SK: "ITEM#item-1",
            id: "item-1",
            teamId: "team-abc",
            nsn: "5306-01-092-5033",
            name: "Bolt",
            createdAt: nowIso,
            updatedAt: nowIso,
            GSI7PK: "TEAM#team-abc#NSN",
            GSI7SK: "5306-01-092-5033",
            GSI2PK: "TEAM#team-abc#PARENT#ROOT",
            GSI2SK: nowIso,
          },
        } as any;
      }
      if (cmd instanceof QueryCommand) {
        // nsn not changing -> no dupes
        return { Items: [] } as any;
      }
      if (cmd instanceof PutCommand) {
        return {} as any;
      }
      throw new Error("Unexpected DDB command in update()");
    });

    // New image exists
    jest.spyOn(s3Client, "send").mockImplementationOnce(async () => ({} as any));

    const res = await caller.itemProfiles.update({
      id: "item-1",
      patch: { imageKey: "teams/team-abc/images/bolt-v2.jpg" },
    });

    expect(res.id).toBe("item-1");
    expect(ddbSpy).toHaveBeenCalled();
  });

  test("list() with parentItemId -> queries GSI_ItemsByParent", async () => {
    const caller = appRouter.createCaller(
      ctx({ "x-user-id": "u1" }, { workspaceId: "team-abc" })
    );

    const ddbSpy = jest.spyOn(doc, "send").mockImplementation(async (cmd: any) => {
      if (cmd instanceof QueryCommand) {
        const input = cmd.input as any;
        expect(input.IndexName).toBe("GSI_ItemsByParent");
        expect(input.KeyConditionExpression).toContain("GSI2PK");
        expect(input.ExpressionAttributeValues[":g2"]).toBe("TEAM#team-abc#PARENT#item-parent");
        return { Items: [] } as any;
      }
      throw new Error("Unexpected DDB command in list()");
    });

    const out = await caller.itemProfiles.list({ parentItemId: "item-parent", limit: 10 });
    expect(out.items).toEqual([]);
    expect(ddbSpy).toHaveBeenCalled();
  });

  test("getById() -> NOT_FOUND when missing", async () => {
    const caller = appRouter.createCaller(
      ctx({ "x-user-id": "u1" }, { workspaceId: "team-abc" })
    );

    jest.spyOn(doc, "send").mockImplementation(async (cmd: any) => {
      if (cmd instanceof GetCommand) {
        return { Item: undefined } as any;
      }
      throw new Error("Unexpected DDB command in getById()");
    });

    await expect(caller.itemProfiles.getById({ id: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("auth: missing user id -> UNAUTHORIZED; missing workspace -> FORBIDDEN", async () => {
    const noUser = appRouter.createCaller(ctx({}, { workspaceId: "team-abc" }));
    await expect(
      noUser.itemProfiles.list({ limit: 1 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const noWorkspace = appRouter.createCaller(ctx({ "x-user-id": "u1" }, {}));
    await expect(
      noWorkspace.itemProfiles.list({ limit: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});