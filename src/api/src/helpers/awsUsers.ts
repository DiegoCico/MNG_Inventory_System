import { QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { doc as dynamo } from '../aws';
import { loadConfig } from '../process';
import crypto from 'crypto';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

function randomUsername(): string {
  return 'user-' + Math.random().toString(36).substring(2, 8);
}

// Ensure uniqueness across GSI_UsersByUsername
async function ensureUniqueUsername(base: string): Promise<string> {
  let username = base;
  let counter = 1;

  while (true) {
    const check = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI_UsersByUsername',
        KeyConditionExpression: 'username = :u',
        ExpressionAttributeValues: { ':u': username },
        Limit: 1,
      }),
    );

    if (!check.Items || check.Items.length === 0) return username;
    username = `${base}${counter++}`;
  }
}

export async function ensureUserRecord({ sub }: { sub: string }): Promise<{
  userId: string;
  username: string;
  name: string;
  role: string;
  accountId: string;
}> {
  // Lookup by UID GSI
  const lookup = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI_UsersByUid',
      KeyConditionExpression: 'GSI6PK = :pk',
      ExpressionAttributeValues: { ':pk': `UID#${sub}` },
      Limit: 1,
    }),
  );

  const item = lookup.Items?.[0];

  // ==================================================
  // USER EXISTS
  // ==================================================
  if (item) {
    let username = item.username;
    let accountId = item.accountId;

    // Fix missing username
    if (!username || username.trim() === '') {
      username = await ensureUniqueUsername(randomUsername());

      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${sub}`, SK: 'METADATA' },
          UpdateExpression: 'SET username = :u, updatedAt = :t',
          ExpressionAttributeValues: {
            ':u': username,
            ':t': new Date().toISOString(),
          },
        }),
      );
    }

    // Fix missing accountId
    if (!accountId) {
      accountId = crypto.randomUUID();

      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${sub}`, SK: 'METADATA' },
          UpdateExpression: 'SET accountId = :a, updatedAt = :t',
          ExpressionAttributeValues: {
            ':a': accountId,
            ':t': new Date().toISOString(),
          },
        }),
      );
    }

    return {
      userId: sub,
      username,
      name: item.name,
      role: item.role || 'User',
      accountId,
    };
  }

  // ==================================================
  // USER DOES NOT EXIST → CREATE
  // ==================================================
  const now = new Date().toISOString();
  const username = await ensureUniqueUsername(randomUsername());
  const accountId = crypto.randomUUID();

  const newUserRecord = {
    PK: `USER#${sub}`,
    SK: 'METADATA',
    sub,
    username,
    name: username,
    role: 'User',
    accountId,
    createdAt: now,
    updatedAt: now,
    GSI6PK: `UID#${sub}`,
    GSI6SK: `USER#${sub}`,
  };

  await dynamo.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: newUserRecord,
    }),
  );

  return {
    userId: sub,
    username,
    name: username,
    role: 'User',
    accountId,
  };
}
