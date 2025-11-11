import { fromIni } from "@aws-sdk/credential-provider-ini";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";
import { loadConfig } from "../process";

// ===== AWS CONFIG =====
const config = loadConfig();
const AWS_REGION = "us-east-1";
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const credentials = isLambda ? undefined : fromIni({ profile: "mng" });

// ===== DYNAMODB CLIENT (DocumentClient) =====
const baseClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials,
});

export const dynamoClient = DynamoDBDocumentClient.from(baseClient);

const USERS_TABLE = config.TABLE_NAME;

// ===== HELPERS =====
function newAccountId() {
  return crypto.randomUUID();
}

/**
 * ensureUserRecord
 * - Looks up a user by Cognito sub (via GSI_UsersByUid)
 * - If not found, creates a proper record with real lowercase email
 * - Ensures consistent email field for GSI_UsersByEmail
 * - Returns { sub, email, accountId }
 */
export async function ensureUserRecord(user: { sub: string; email?: string }) {
  const uid = user.sub;
  const pk = `USER#${uid}`;
  const sk = "METADATA";

  // --- Check if user already exists via GSI_UsersByUid ---
  const existing = await dynamoClient.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "GSI_UsersByUid",
      KeyConditionExpression: "GSI6PK = :pk",
      ExpressionAttributeValues: { ":pk": `UID#${uid}` },
      Limit: 1,
    })
  );

  if (existing.Items && existing.Items.length > 0) {
    const item = existing.Items[0];
    return {
      sub: uid,
      email: item.email ?? user.email ?? `${uid}@example.com`,
      accountId: item.accountId ?? uid,
    };
  }

  // --- Normalize email ---
  let email = user.email?.toLowerCase().trim();
  if (!email || !email.includes("@")) {
    email = `${uid}@example.com`;
    console.warn(`⚠️ User ${uid} has no valid email — using ${email}`);
  }

  // --- Create a new user record ---
  const accountId = newAccountId();
  const now = new Date().toISOString();

  const newUser = {
    PK: pk,
    SK: sk,
    Type: "User",
    sub: uid,
    accountId,
    email, 
    createdAt: now,
    updatedAt: now,
    // GSIs
    GSI6PK: `UID#${uid}`,
    GSI6SK: `USER#${uid}`,
    GSI_NAME: email, // optional alias for lookup
  };

  await dynamoClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: newUser,
    })
  );

  console.log(`✅ Created new user record for ${email}`);

  return { sub: uid, email, accountId };
}
