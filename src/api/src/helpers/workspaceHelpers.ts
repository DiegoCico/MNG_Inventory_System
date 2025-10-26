import { GetCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { doc } from '../aws';
import { WorkspaceEntity, WorkspaceMemberEntity } from '../dynamo-types';

const TABLE_NAME = process.env.TABLE_NAME || 'mng-dev-data';

export const id = (n = 10): string => {
  return crypto
    .randomBytes(n)
    .toString('base64')
    .replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] as string);
};

/** Get workspace metadata */
export const getWorkspace = async (workspaceId: string): Promise<WorkspaceEntity | null> => {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `WORKSPACE#${workspaceId}`, SK: 'METADATA' },
    }),
  );
  return (res.Item as WorkspaceEntity) ?? null;
};

/** Get user's role in a workspace */
export const getUserRoleInWorkspace = async (
  userId: string,
  workspaceId: string,
): Promise<string | null> => {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `WORKSPACE#${workspaceId}`, SK: `MEMBER#${userId}` },
    }),
  );
  return (res.Item as WorkspaceMemberEntity)?.roleId ?? null;
};

/** Get role permissions */
export const getRolePermissions = async (roleId: string): Promise<string[]> => {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
    }),
  );
  return (res.Item as any)?.permissions ?? [];
};

/** Check if user has required permission in workspace */
export const checkPermission = async (
  userId: string,
  workspaceId: string,
  requiredPermission: string,
): Promise<{ allowed: boolean; reason?: string }> => {
  // Get user's role in workspace
  const roleId = await getUserRoleInWorkspace(userId, workspaceId);

  if (!roleId) {
    return { allowed: false, reason: 'You are not a member of this workspace' };
  }

  // Get role permissions
  const permissions = await getRolePermissions(roleId);

  // Check if user has the required permission
  if (!permissions.includes(requiredPermission)) {
    return {
      allowed: false,
      reason: `You don't have permission to perform this action (requires: ${requiredPermission})`,
    };
  }

  return { allowed: true };
};
