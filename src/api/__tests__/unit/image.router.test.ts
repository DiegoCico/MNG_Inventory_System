// mock presigner first
jest.mock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: jest.fn(async () => "https://mock-s3-url.com/fake-object")
  }));
  
import request from "supertest";
import app from "../../src/server";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";


// helper to check command type
const isCmd = (cmd: unknown, name: string) =>
  Boolean(cmd) && (cmd as any).constructor?.name === name;

let s3SendSpy: jest.SpyInstance;
let ddbSendSpy: jest.SpyInstance;

beforeAll(() => {
  s3SendSpy = jest.spyOn(S3Client.prototype, "send");
  ddbSendSpy = jest.spyOn(DynamoDBDocumentClient.prototype, "send");
});

afterAll(() => {
  s3SendSpy.mockRestore();
  ddbSendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Image Router", () => {
  it("health route works", async () => {
    const res = await request(app).get("/images/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, scope: "images" });
  });

  it("upload-url route returns presigned data (mocked)", async () => {
    s3SendSpy.mockResolvedValue({});

    const res = await request(app)
      .post("/images/upload-url")
      .set("content-type", "application/json")
      .send({ teamId: "alpha", serial: "SN1", mime: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("url");
    expect(res.body).toHaveProperty("s3Key");
    expect(res.body).toHaveProperty("imageId");
  });

  it("confirm upload writes to DynamoDB (mocked)", async () => {
    ddbSendSpy.mockImplementation(async (cmd: any) => {
      if (isCmd(cmd, "PutCommand")) return { ok: true };
      return {};
    });

    const res = await request(app)
      .post("/images/confirm")
      .set("content-type", "application/json")
      .send({
        teamId: "alpha",
        serial: "SN1",
        s3Key: "items/alpha/SN1/abc123.jpg",
        mime: "image/jpeg",
        uploadedBy: "tester",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("list route returns Items array (mocked)", async () => {
    ddbSendSpy.mockImplementation(async (cmd: any) => {
      if (isCmd(cmd, "QueryCommand")) {
        return { Items: [{ pk: "ITEM#SN1", sk: "IMAGE#...", s3Key: "foo.jpg" }] };
      }
      return {};
    });

    const res = await request(app).get("/images/list/SN1");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("download route returns URL (mocked)", async () => {
    s3SendSpy.mockResolvedValue({});
    const res = await request(app)
      .get("/images/download")
      .query({ s3Key: "items/alpha/SN1/abc123.jpg" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("url");
  });

  it("delete route calls Dynamo + S3 (mocked)", async () => {
    ddbSendSpy.mockResolvedValue({});
    s3SendSpy.mockResolvedValue({});

    const res = await request(app)
      .delete("/images")
      .set("content-type", "application/json")
      .send({
        serial: "SN1",
        sk: "IMAGE#2025-01-01#abc123",
        s3Key: "items/alpha/SN1/abc123.jpg",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});