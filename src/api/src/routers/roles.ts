import { z } from 'zod';
import { router, publicProcedure, permissionedProcedure, protectedProcedure } from './trpc';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
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
  | 'team.delete'
  // user management
  | 'user.invite'
  | 'user.delete'
  | 'user.assign_roles'
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
  | 'item.reset'
  // Report handling
  | 'reports.create'
  | 'reports.view'
  | 'reports.delete';

export interface RoleEntity {
  PK: `ROLE#${string}`;
  SK: 'METADATA';
  roleId: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

const roleInput = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(280).optional(),
  permissions: z.array(z.string().min(1)).min(1),
});

const updateRoleInput = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(280).optional(),
  permissions: z.array(z.string().min(1)).min(1).optional(),
});

async function getRole(roleId: string): Promise<RoleEntity | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
    }),
  );
  return (res.Item as RoleEntity) ?? null;
}

export const DEFAULT_ROLES: Array<Pick<RoleEntity, 'name' | 'description' | 'permissions'>> = [
  {
    name: 'Owner',
    description: 'Full administrative control over the system.',
    permissions: [
      'team.create',
      'team.add_member',
      'team.remove_member',
      'team.view',
      'team.delete',
      'role.add',
      'role.modify',
      'role.remove',
      'role.view',
      'user.invite',
      'user.delete',
      'user.assign_roles',
      'item.create',
      'item.update',
      'item.delete',
      'item.view',
      'item.reset',
      'reports.create',
      'reports.view',
      'reports.delete',
    ],
  },
  {
    name: 'Manager',
    description: 'Manage members, items, and reports.',
    permissions: [
      'team.create',
      'team.add_member',
      'team.remove_member',
      'team.view',
      'item.create',
      'item.view',
      'item.update',
      'reports.create',
      'reports.view',
    ],
  },
  {
    name: 'Member',
    description: 'Limited access to view and report items.',
    permissions: ['item.view', 'reports.create', 'reports.view', 'team.view'],
  },
];

export const rolesRouter = router({
  createRole: permissionedProcedure('role.add')
    .input(roleInput)
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();
      const roleId = input.name.trim().toUpperCase();

      const existing = await getRole(roleId);
      if (existing) {
        throw new Error(`Role "${input.name}" already exists`);
      }

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

      return { success: true, role };
    }),

  getAllRoles: permissionedProcedure('role.view').query(async () => {
    const res = await doc.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'ROLE#',
          ':sk': 'METADATA',
        },
      }),
    );

    const roles = (res.Items ?? []) as RoleEntity[];
    return { roles };
  }),

  getRole: protectedProcedure
    .input(z.object({ roleId: z.string().optional(), name: z.string().optional() }))
    .query(async ({ input }) => {
      if (!input.roleId && !input.name) throw new Error('Provide roleId or name');
      const roleId = input.roleId || input.name!.toUpperCase();
      const role = await getRole(roleId);
      if (!role) throw new Error('Role not found');
      return { role };
    }),

  updateRole: permissionedProcedure('role.modify')
    .input(updateRoleInput)
    .mutation(async ({ input }) => {
      const roleId = input.name.trim().toUpperCase();
      const existing = await getRole(roleId);
      if (!existing) throw new Error('Role not found');

      const now = new Date().toISOString();
      const values: Record<string, string | Permission[]> = { ':updatedAt': now };
      const attrNames: Record<string, string> = {};
      const sets: string[] = ['updatedAt = :updatedAt'];

      if (input.name && input.name !== existing.name) {
        sets.push('#name = :name');
        attrNames['#name'] = 'name';
        values[':name'] = input.name.trim();
      }
      if (typeof input.description !== 'undefined') {
        sets.push('description = :desc');
        values[':desc'] = input.description ?? '';
      }
      if (input.permissions) {
        sets.push('#permissions = :perms');
        attrNames['#permissions'] = 'permissions';
        values[':perms'] = input.permissions as Permission[];
      }

      const updated = await doc.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
          UpdateExpression: `SET ${sets.join(', ')}`,
          ExpressionAttributeNames: Object.keys(attrNames).length > 0 ? attrNames : undefined,
          ExpressionAttributeValues: values,
          ReturnValues: 'ALL_NEW',
        }),
      );

      return { success: true, role: updated.Attributes as RoleEntity };
    }),

  deleteRole: permissionedProcedure('role.remove')
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const roleId = input.name.trim().toUpperCase();
      const role = await getRole(roleId);
      if (!role) return { success: true, deleted: false };

      await doc.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
        }),
      );

      return { success: true, deleted: true };
    }),
});
