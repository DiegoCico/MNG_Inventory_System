import { describe, it, beforeEach, expect } from "vitest";
import request from "supertest";
import express from "express";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";


import { s3Router } from "../src/routers/S3.options";

const s3Mock = mockClient(S3Client);

function testApp() {
  const app = express();
  app.use(express.json({ limit: "15mb" })); 
  app.post("/trpc/s3.uploadImage", async (req, res) => {
    try {
      // tRPC caller emulation:
      const caller = s3Router.createCaller({} as any);
      const result = await caller.uploadImage(req.body?.input);
      res.json({ result: { data: result } });
    } catch (e: any) {
      res.json({ error: { message: e?.message ?? "error" } });
    }
  });
  return app;
}

describe("tRPC s3.uploadImage (dataUrl only)", () => {
  beforeEach(() => s3Mock.reset());

  it("uploads a PNG data URL", async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const app = testApp();
    // tiny fake PNG
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAA=="; 

    const res = await request(app)
      .post("/trpc/s3.uploadImage")
      .send({ input: { key: "my-test.png", dataUrl } })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body?.result?.data?.ok).toBe(true);
    expect(res.body?.result?.data?.key).toBe("images/my-test.png");

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls.length).toBe(1);
    expect(calls[0].args[0].input.Bucket).toBeTruthy();
    expect(calls[0].args[0].input.Key).toBe("images/my-test.png");
    expect(calls[0].args[0].input.ContentType).toBe("image/png");
  });

  it("rejects non-image data URLs", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const app = testApp();
    const bad = "data:application/pdf;base64,JVBERi0xLjQK";

    const res = await request(app)
      .post("/trpc/s3.uploadImage")
      .send({ input: { key: "doc.pdf", dataUrl: bad } })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(String(res.body?.error?.message)).toMatch(/Invalid content-type/i);
    expect(s3Mock.commandCalls(PutObjectCommand).length).toBe(0);
  });

  it("rejects invalid dataUrl format", async () => {
    const app = testApp();
    const res = await request(app)
      .post("/trpc/s3.uploadImage")
      .send({ input: { key: "x", dataUrl: "not-a-data-url" } })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(String(res.body?.error?.message)).toMatch(/Invalid data URL/i);
  });
});