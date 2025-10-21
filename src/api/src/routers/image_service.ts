import express from "express";
import crypto from "crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { QueryCommandInput, QueryCommandOutput } from "@aws-sdk/lib-dynamodb";

/**
 * ─────────────────────────────────────────────────────────────
 * Self-contained AWS clients (no external imports required)
 * ─────────────────────────────────────────────────────────────
 */
const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.TABLE_NAME || "mng-dev-data";
const BUCKET_NAME = process.env.BUCKET_NAME || "mng-dev-images";

const s3Client = new S3Client({ region: REGION });

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

/**
 * ─────────────────────────────────────────────────────────────
 * Router
 * ─────────────────────────────────────────────────────────────
 */
const router = express.Router();
const IMAGE_PREFIX = "IMAGE#";

function makeS3Key(teamId: string, serial: string, imageId: string, ext: string) {
  return `items/${teamId}/${serial}/${imageId}.${ext}`;
}

// Health check
router.get("/health", (_req, res) => {
  res.json({ ok: true, scope: "images" });
});

// Generate presigned PUT URL
router.post("/upload-url", async (req, res) => {
  try {
    const { teamId, serial, mime } = req.body as { teamId?: string; serial?: string; mime?: string };
    if (!teamId || !serial || !mime) return res.status(400).json({ error: "Missing parameters" });

    const imageId = crypto.randomBytes(6).toString("hex");
    const ext = mime === "image/png" ? "png" : "jpg";
    const key = makeS3Key(teamId, serial, imageId, ext);

    const putCmd = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: mime });
    const url = await getSignedUrl(s3Client, putCmd, { expiresIn: 900 });

    res.json({ url, s3Key: key, imageId });
  } catch (err) {
    console.error("upload-url error:", err);
    res.status(500).json({ error: "Failed to create upload URL" });
  }
});

// Confirm upload (write image node into DynamoDB)
router.post("/confirm", async (req, res) => {
  try {
    const { teamId, serial, s3Key, mime, uploadedBy } = req.body as {
      teamId?: string; serial?: string; s3Key?: string; mime?: string; uploadedBy?: string;
    };
    if (!teamId || !serial || !s3Key) return res.status(400).json({ error: "Missing parameters" });

    const uploadedAt = new Date().toISOString();
    const imageId = s3Key.split("/").pop()!.split(".")[0];

    await ddbDocClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `ITEM#${serial}`,
        sk: `${IMAGE_PREFIX}${uploadedAt}#${imageId}`,
        teamId,
        s3Key,
        mime,
        uploadedBy,
        uploadedAt,
      },
    }));

    res.json({ ok: true });
  } catch (err) {
    console.error("confirm error:", err);
    res.status(500).json({ error: "Failed to confirm upload" });
  }
});

// List images for an item by serial
router.get("/list/:serial", async (req, res) => {
    try {
      const { serial } = req.params;
  
      const params: QueryCommandInput = {
        TableName: TABLE_NAME,
        KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :pref)",
        ExpressionAttributeNames: { "#pk": "pk", "#sk": "sk" },
        ExpressionAttributeValues: { ":pk": `ITEM#${serial}`, ":pref": IMAGE_PREFIX },
        ScanIndexForward: false,
      };
  
      const result = (await ddbDocClient.send(new QueryCommand(params))) as QueryCommandOutput;
  
      res.json(result.Items ?? []);
    } catch (err) {
      console.error("list error:", err);
      res.status(500).json({ error: "Failed to list images" });
    }
  });

// Presigned download URL
router.get("/download", async (req, res) => {
  try {
    const { s3Key } = req.query as { s3Key?: string };
    if (!s3Key) return res.status(400).json({ error: "Missing s3Key" });

    const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key });
    const url = await getSignedUrl(s3Client, getCmd, { expiresIn: 3600 });

    res.json({ url });
  } catch (err) {
    console.error("download error:", err);
    res.status(500).json({ error: "Failed to get download URL" });
  }
});

// Delete image (DB + S3)
router.delete("/", async (req, res) => {
  try {
    const { serial, sk, s3Key } = req.body as { serial?: string; sk?: string; s3Key?: string };
    if (!serial || !sk || !s3Key) return res.status(400).json({ error: "Missing parameters" });

    await ddbDocClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: `ITEM#${serial}`, sk },
    }));
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));

    res.json({ ok: true });
  } catch (err) {
    console.error("delete error:", err);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

export default router;