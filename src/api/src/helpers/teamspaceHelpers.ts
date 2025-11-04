import { GetCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { doc } from '../aws';
import { TeamEntity, TeamMemberEntity } from '../dynamo-types';

const TABLE_NAME = process.env.TABLE_NAME || 'mng-dev-data';

/**
 * Generate a short, URL-safe random ID
 * e.g. "ZyJfTQwKse"
 */
export const id = (n = 10): string => {
  return crypto
    .randomBytes(n)
    .toString('base64')
    .replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] as string);
};

/**
 * Get teamspace metadata
 * PK: TEAM#<teamId>
 * SK: METADATA
 */
export const getTeamspace = async (teamId: string): Promise<TeamEntity | null> => {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TEAM#${teamId}`, SK: 'METADATA' },
    }),
  );
  return (res.Item as TeamEntity) ?? null;
};

/**
 * Get user's role in a specific teamspace
 * PK: TEAM#<teamId>
 * SK: MEMBER#<userId>
 */
export const getUserRoleInTeamspace = async (
  userId: string,
  teamId: string,
): Promise<string | null> => {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TEAM#${teamId}`, SK: `MEMBER#${userId}` },
    }),
  );
  return (res.Item as TeamMemberEntity)?.roleId ?? null;
};

/**
 * Get role permissions for a specific role
 * PK: ROLE#<roleId>
 * SK: METADATA
 */
export const getRolePermissions = async (roleId: string): Promise<string[]> => {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
    }),
  );
  return (res.Item as any)?.permissions ?? [];
};

/**
 * Check if user has a required permission in a given teamspace
 * Returns an object with allowed = true/false and an optional reason.
 */
export const checkPermission = async (
  userId: string,
  teamId: string,
  requiredPermission: string,
): Promise<{ allowed: boolean; reason?: string }> => {
  // 1️⃣ Get the user's role in this teamspace
  const roleId = await getUserRoleInTeamspace(userId, teamId);

  if (!roleId) {
    return { allowed: false, reason: 'You are not a member of this teamspace' };
  }

  // 2️⃣ Fetch permissions for that role
  const permissions = await getRolePermissions(roleId);

  // 3️⃣ Verify required permission
  if (!permissions.includes(requiredPermission)) {
    return {
      allowed: false,
      reason: `You don't have permission to perform this action (requires: ${requiredPermission})`,
    };
  }

  return { allowed: true };
};
