import { fromIni } from "@aws-sdk/credential-provider-ini";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

// ===== AWS CONFIG =====
const AWS_REGION = "us-east-1";
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const credentials = isLambda ? undefined : fromIni({ profile: "mng" });

// ===== DYNAMODB CLIENT (DocumentClient) =====
const baseClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials,
});

export const dynamoClient = DynamoDBDocumentClient.from(baseClient);

const USERS_TABLE = process.env.USERS_TABLE || "mng-dev-data";

// ===== HELPERS =====
function newAccountId() {
  return crypto.randomUUID();
}

/**
 * ensureUserRecord
 * - Checks for an existing user by Cognito sub via GSI_UsersByUid (UID#<sub>)
 * - If missing, creates a new minimal user entry
 * - Returns { sub, email, accountId }
 */
export async function ensureUserRecord(user: { sub: string; email: string }) {
  const uid = user.sub;
  const pk = `USER#${uid}`;
  const sk = "METADATA";

  // --- Check if user exists via GSI_UsersByUid ---
  const queryResp = await dynamoClient.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "GSI_UsersByUid",
      KeyConditionExpression: "GSI6PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `UID#${uid}`,
      },
      Limit: 1,
    })
  );

  if (queryResp.Items && queryResp.Items.length > 0) {
    const item = queryResp.Items[0];
    return {
      sub: uid,
      email: item.email ?? user.email,
      accountId: item.accountId ?? uid,
    };
  }

  // --- Create new user record ---
  const accountId = newAccountId();
  const nowIso = new Date().toISOString();

  const newUser = {
    PK: pk,
    SK: sk,
    Type: "User",
    sub: uid,
    email: user.email,
    accountId,
    createdAt: nowIso,
    updatedAt: nowIso,
    GSI6PK: `UID#${uid}`,
    GSI6SK: `USER#${uid}`,
  };

  await dynamoClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: newUser,
    })
  );

  console.log(`✅ Created new user record for ${user.email}`);

  return {
    sub: uid,
    email: user.email,
    accountId,
  };
}
