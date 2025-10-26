import { fromIni } from "@aws-sdk/credential-provider-ini";
import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import crypto from "crypto";

const AWS_REGION = "us-east-1";
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const credentials = isLambda ? undefined : fromIni({ profile: "mng" });

export const dynamoClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials,
});

const USERS_TABLE = process.env.USERS_TABLE || "MNGMainTable";

function newAccountId() {
  return crypto.randomUUID();
}

/**
 * ensureUserRecord
 * - lookup user by Cognito sub via GSI6_UsersByUid
 * - if missing, create a new user item
 * - always return { sub, email, accountId }
 */
export async function ensureUserRecord(user: { sub: string; email: string }) {
  const uid = user.sub;
  const pk = `USER#${uid}`;
  const sk = pk;

  // Check if it already exists using the GSI6_UsersByUid index
  const queryResp = await dynamoClient.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "GSI6_UsersByUid",
      KeyConditionExpression: "GSI6PK = :gsi6pk",
      ExpressionAttributeValues: {
        ":gsi6pk": { S: `USER#${uid}` },
      },
      Limit: 1,
    })
  );

  if (queryResp.Items && queryResp.Items.length > 0) {
    const item = queryResp.Items[0];
    return {
      sub: uid,
      email: item.email?.S ?? user.email,
      accountId:
        item.accountId?.S ??
        item.PK?.S ?? // fallback, but we expect accountId
        pk,
    };
  }

  // Not found -> create new user row
  const accountId = newAccountId();
  const nowIso = new Date().toISOString();

  await dynamoClient.send(
    new PutItemCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: { S: pk },
        SK: { S: sk },
        Type: { S: "User" },

        sub: { S: uid },
        email: { S: user.email },
        accountId: { S: accountId },

        createdAt: { S: nowIso },
        updatedAt: { S: nowIso },

        // GSI6 so we can look up by UID quickly
        GSI6PK: { S: `USER#${uid}` },
        GSI6SK: { S: nowIso },
      },
    })
  );

  return {
    sub: uid,
    email: user.email,
    accountId,
  };
}
