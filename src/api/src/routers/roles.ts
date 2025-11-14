import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { doc } from '../aws';
import { loadConfig } from '../process';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

export type Permission =
  // Team management
  | 'team.create'
  | 'team.add_member'
  | 'team.remove_member'
  | 'team.view'
  // Workspace management
  | 'workspace.create'
  | 'workspace.delete'
  | 'workspace.view'
  // Role management
  | 'role.add'
  | 'role.modify'
  | 'role.remove'
  | 'role.view'
  // Item management
  | 'item.create'
  | 'item.view'
  | 'item.update'
  | 'item.delete'
  | 'item.upload_image'
  | 'item.manage_damage'
  // Damage report handling
  | 'damage.create'
  | 'damage.update'
  | 'damage.view'
  | 'damage.delete'
  // Audit / logs
  | 'log.view'
  | 'log.export'
  // S3-related
  | 's3.upload'
  | 's3.delete'
  | 's3.view';

export interface RoleEntity {
  PK: `ROLE#${string}`;
  SK: 'METADATA';
  roleId: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

const roleInput = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(280).optional(),
  permissions: z.array(z.string().min(1)).min(1),
});

const updateRoleInput = z.object({
  roleId: z.string().min(1),
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(280).optional(),
  permissions: z.array(z.string().min(1)).min(1).optional(),
});

function id(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString('base64')
    .replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] as string);
}

/** Fast name→id resolver (avoid scans) */
async function putNameResolver(name: string, roleId: string) {
  const resolver = { PK: `ROLENAME#${name.toLowerCase()}`, SK: `ROLE#${roleId}` };
  await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: resolver }));
}

/** Get role by id */
async function getRole(roleId: string): Promise<RoleEntity | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
    }),
  );
  return (res.Item as RoleEntity) ?? null;
}

/** Get role by name (via resolver) */
async function getRoleByName(name: string): Promise<RoleEntity | null> {
  const q = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `ROLENAME#${name.toLowerCase()}`,
        ':sk': 'ROLE#',
      },
      Limit: 1,
    }),
  );
  const ref = q.Items?.[0] as { SK?: string } | undefined;
  if (!ref?.SK?.startsWith('ROLE#')) return null;
  const roleId = ref.SK.slice('ROLE#'.length);
  return getRole(roleId);
}

export const DEFAULT_ROLES: Array<Pick<RoleEntity, 'name' | 'description' | 'permissions'>> = [
  {
    name: 'Owner',
    description: 'Full administrative control over the system.',
    permissions: [
      // Core admin
      'team.create',
      'team.add_member',
      'team.remove_member',
      'workspace.create',
      'workspace.delete',
      'role.add',
      'role.modify',
      'role.remove',
      'role.view',
      // Item admin
      'item.create',
      'item.update',
      'item.delete',
      'item.view',
      'item.upload_image',
      'item.manage_damage',
      // Damage reports
      'damage.create',
      'damage.update',
      'damage.delete',
      'damage.view',
      // S3 and logs
      's3.upload',
      's3.delete',
      's3.view',
      'log.view',
      'log.export',
    ],
  },
  {
    name: 'Manager',
    description: 'Manage members, items, and reports.',
    permissions: [
      'team.add_member',
      'team.remove_member',
      'workspace.create',
      'item.create',
      'item.view',
      'item.update',
      'damage.create',
      'damage.view',
      's3.upload',
    ],
  },
  {
    name: 'Member',
    description: 'Limited access to view and report items.',
    permissions: ['item.view', 'damage.create', 'damage.view'],
  },
];

export const rolesRouter = router({
  /** Create a role with explicit permissions */
  createRole: publicProcedure.input(roleInput).mutation(async ({ input }) => {
    const now = new Date().toISOString();
    const roleId = id();

    const role: RoleEntity = {
      PK: `ROLE#${roleId}`,
      SK: 'METADATA',
      roleId,
      name: input.name.trim(),
      description: input.description,
      permissions: input.permissions as Permission[],
      createdAt: now,
      updatedAt: now,
    };

    await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: role }));
    await putNameResolver(role.name, roleId);

    return { success: true, role };
  }),

  /** Get one role by id or name */
  getRole: publicProcedure
    .input(z.object({ roleId: z.string().optional(), name: z.string().optional() }))
    .query(async ({ input }) => {
      if (!input.roleId && !input.name) throw new Error('Provide roleId or name');
      const role = input.roleId ? await getRole(input.roleId) : await getRoleByName(input.name!);
      if (!role) throw new Error('Role not found');
      return { role };
    }),

  /** Update role metadata and/or permissions */
  updateRole: publicProcedure.input(updateRoleInput).mutation(async ({ input }) => {
    const existing = await getRole(input.roleId);
    if (!existing) throw new Error('Role not found');

    const now = new Date().toISOString();
    const names: Record<string, any> = { ':updatedAt': now };
    const sets: string[] = ['updatedAt = :updatedAt'];

    if (input.name && input.name !== existing.name) {
      sets.push('name = :name');
      names[':name'] = input.name.trim();
    }
    if (typeof input.description !== 'undefined') {
      sets.push('description = :desc');
      names[':desc'] = input.description ?? null;
    }
    if (input.permissions) {
      sets.push('permissions = :perms');
      names[':perms'] = input.permissions as Permission[];
    }

    const updated = await doc.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ROLE#${input.roleId}`, SK: 'METADATA' },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeValues: names,
        ReturnValues: 'ALL_NEW',
      }),
    );

    // keep resolver in sync if the name changed
    if (input.name && input.name !== existing.name) {
      await putNameResolver(input.name, input.roleId);
    }

    return { success: true, role: updated.Attributes as RoleEntity };
  }),

  /** Delete a role (consider forbidding deletes if a role is in use) */
  deleteRole: publicProcedure
    .input(z.object({ roleId: z.string() }))
    .mutation(async ({ input }) => {
      const role = await getRole(input.roleId);
      if (!role) return { success: true, deleted: false };

      await doc.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ROLE#${role.roleId}`, SK: 'METADATA' },
        }),
      );

      return { success: true, deleted: true };
    }),
});
