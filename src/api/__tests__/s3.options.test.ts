import request from "supertest";
import express from "express";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Router } from "../src/routers/s3.options.router";

const s3Mock = mockClient(S3Client);

function testApp() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.post("/trpc/s3.uploadImage", async (req, res) => {
    try {
      const caller = s3Router.createCaller({} as any);
      const result = await caller.uploadImage(req.body?.input);
      res.json({ result: { data: result } });
    } catch (e: any) {
      res.json({ error: { message: e?.message ?? "error" } });
    }
  });
  return app;
}

describe("tRPC s3.uploadImage (dataUrl only, server-generated key)", () => {
  beforeEach(() => s3Mock.reset());

  it("uploads PNG under server prefix and returns opaque id only", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const app = testApp();

    const res = await request(app)
      .post("/trpc/s3.uploadImage")
      .send({ input: { dataUrl: "data:image/png;base64,iVBORw0KGgoAAA==" } })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    const data = res.body?.result?.data;
    expect(data?.ok).toBe(true);
    expect(typeof data?.id).toBe("string");
    expect(data?.id.length).toBeGreaterThan(10);
    expect(["item", "user"]).toContain(data?.category);

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls.length).toBe(1);
    const input = calls[0].args[0].input;
    expect(input.Key).toMatch(/^items\/[0-9a-f-]+\.png$/i);
    expect(input.ContentType).toBe("image/png");

    expect(data.key).toBeUndefined();
  });

  it("rejects non-image data URLs", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const app = testApp();

    const res = await request(app)
      .post("/trpc/s3.uploadImage")
      .send({ input: { dataUrl: "data:application/pdf;base64,JVBERi0xLjQK" } })
      .set("Content-Type", "application/json");

    expect(String(res.body?.error?.message)).toMatch(/Invalid content-type/i);
    expect(s3Mock.commandCalls(PutObjectCommand).length).toBe(0);
  });

  it("supports category=user and generates users/ prefix", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const app = testApp();

    const res = await request(app)
      .post("/trpc/s3.uploadImage")
      .send({
        input: {
          category: "user",
          dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
        },
      })
      .set("Content-Type", "application/json");

    const data = res.body?.result?.data;
    expect(data?.ok).toBe(true);
    expect(data?.category).toBe("user");

    const calls = s3Mock.commandCalls(PutObjectCommand);
    const key = calls[0].args[0].input.Key as string;
    expect(key.startsWith("users/")).toBe(true);
    expect(key.toLowerCase().endsWith(".jpg")).toBe(true);
  });
});
