/**
 * UNIT TESTS - tRPC S3 Router
 *
 * These tests use an Express harness + tRPC caller and mock AWS S3 with aws-sdk-client-mock.
 * They validate upload, signed URL, list, delete, and health behaviors from the refactored s3.ts.
 */

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async () => "https://mock-s3-url.com/fake-object"),
}));

import request from "supertest";
import express from "express";
import { mockClient } from "aws-sdk-client-mock";

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { s3Router } from "../../src/routers/s3";

// --- Helpers & Setup ---

const s3Mock = mockClient(S3Client);

// Small harness to call tRPC router procedures over HTTP-like routes
function testApp(ctx: any = {}) {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  // GET helper for tRPC-style input encoding
  const decodeInput = (q: any) => {
    const raw = typeof q?.input === "string" ? q.input : undefined;
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      return null;
    }
  };

  app.get("/trpc/s3.health", async (_req, res) => {
    try {
      const caller = s3Router.createCaller(ctx);
      const result = await caller.s3health();
      res.json({ result: { data: result } });
    } catch (e: any) {
      res.status(500).json({ error: { message: e?.message ?? "error" } });
    }
  });

  app.post("/trpc/s3.uploadImage", async (req, res) => {
    try {
      const caller = s3Router.createCaller(ctx);
      const result = await caller.uploadImage(req.body?.input);
      res.json({ result: { data: result } });
    } catch (e: any) {
      res.json({ error: { message: e?.message ?? "error" } });
    }
  });

  app.get("/trpc/s3.getSignedUrl", async (req, res) => {
    try {
      const caller = s3Router.createCaller(ctx);
      const result = await caller.getSignedUrl(decodeInput(req.query));
      res.json({ result: { data: result } });
    } catch (e: any) {
      res.json({ error: { message: e?.message ?? "error" } });
    }
  });

  app.get("/trpc/s3.listImages", async (req, res) => {
    try {
      const caller = s3Router.createCaller(ctx);
      const result = await caller.listImages(decodeInput(req.query));
      res.json({ result: { data: result } });
    } catch (e: any) {
      res.json({ error: { message: e?.message ?? "error" } });
    }
  });

  app.post("/trpc/s3.deleteObject", async (req, res) => {
    try {
      const caller = s3Router.createCaller(ctx);
      const result = await caller.deleteObject(req.body?.input);
      res.json({ result: { data: result } });
    } catch (e: any) {
      res.json({ error: { message: e?.message ?? "error" } });
    }
  });

  return app;
}

// Helper to encode tRPC GET inputs (?input=...)
const enc = (obj: any) => encodeURIComponent(JSON.stringify(obj));

describe("tRPC s3 router", () => {
  beforeEach(() => {
    s3Mock.reset();
    process.env.S3_BUCKET = process.env.S3_BUCKET || "unit-test-bucket";
  });

  it("health works", async () => {
    const app = testApp();
    const res = await request(app).get(`/trpc/s3.health`);
    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({ ok: true, scope: "s3" });
  });

  it("uploadImage: uploads PNG under team/scope prefix and returns S3 metadata", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    s3Mock.on(HeadObjectCommand).resolves({}); // used for presign existence

    const app = testApp();

    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAH/gL+oQyZVQAAAABJRU5ErkJggg==";

    const input = {
      scope: "item" as const,
      serialNumber: "SN1",
      dataUrl,
      alt: "demo",
    };

    const res = await request(app)
      .post("/trpc/s3.uploadImage")
      .set("content-type", "application/json")
      .send({ input });

    expect(res.status).toBe(200);
    const data = res.body?.result?.data;
    expect(data).toHaveProperty("key");
    expect(data).toHaveProperty("contentType", "image/png");
    expect(typeof data?.size).toBe("number");
    expect(String(data?.headUrl)).toMatch(/^https:\/\/mock-s3-url\.com/);

    // Assert we invoked PutObject with a key shaped by team/scope/item info
    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls.length).toBe(1);
    const putIn = calls[0].args[0].input as any;
    expect(putIn.Bucket).toBe(process.env.S3_BUCKET);
    expect(putIn.ContentType).toBe("image/png");
    expect(String(putIn.Key)).toMatch(
      /^teams\/alpha\/item\/items\/(serial-SN1|item-[A-Za-z0-9._-]+)\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}_SN1\.png$/i
    );
  });

  it("uploadImage: rejects non-image data URLs", async () => {
    s3Mock.on(PutObjectCommand).resolves({}); // should NOT be called
    const app = testApp();

    const res = await request(app)
      .post("/trpc/s3.uploadImage")
      .set("content-type", "application/json")
      .send({
        input: {
          scope: "team",
          dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
        },
      });

    expect(String(res.body?.error?.message)).toMatch(/Unsupported mime/i);
    expect(s3Mock.commandCalls(PutObjectCommand).length).toBe(0);
  });

  it("getSignedUrl: returns a URL (mocked)", async () => {
    // existence check
    s3Mock.on(HeadObjectCommand).resolves({});
    const app = testApp();

    const res = await request(app).get(
      `/trpc/s3.getSignedUrl?input=${enc({
        key: "teams/alpha/item/items/serial-SN1/2025/10/23/a.png",
        expiresIn: 300,
      })}`
    );

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toHaveProperty("url");
    expect(String(res.body?.result?.data?.url)).toMatch(/^https:\/\/mock-s3-url\.com/);
  });

  it("listImages: returns items array (mocked)", async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      Contents: [
        {
          Key: "teams/alpha/item/items/serial-SN1/2025/10/23/a.png",
          Size: 123,
          LastModified: new Date(),
        },
      ],
      NextContinuationToken: undefined,
    });

    const app = testApp();

    const res = await request(app).get(
      `/trpc/s3.listImages?input=${enc({
        scope: "item",
        serialNumber: "SN1",
        limit: 10,
      })}`
    );

    expect(res.status).toBe(200);
    const out = res.body?.result?.data;
    expect(Array.isArray(out.items)).toBe(true);
    expect(out.items[0]).toHaveProperty("key");
  });

  it("deleteObject: removes S3 key (mocked)", async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});
    const app = testApp({
      // Optional: Provide a fake images repo in ctx to verify we don't crash
      repos: { images: { removeByKey: async () => ({ ok: true }) } },
      logger: { warn: () => void 0 },
    });

    const res = await request(app)
      .post("/trpc/s3.deleteObject")
      .set("content-type", "application/json")
      .send({
        input: { key: "teams/alpha/item/items/serial-SN1/2025/10/23/a.png" },
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toEqual({ ok: true });

    const delCalls = s3Mock.commandCalls(DeleteObjectCommand);
    expect(delCalls.length).toBe(1);
    expect(delCalls[0].args[0].input.Key).toBe(
      "teams/alpha/item/items/serial-SN1/2025/10/23/a.png"
    );
  });
});