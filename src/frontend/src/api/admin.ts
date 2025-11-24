import { trpcFetch } from './utils';

const TRPC = '/trpc';

export async function listUsersWithRoles() {
  return await trpcFetch(
    `${TRPC}/listUsersWithRoles?input=${encodeURIComponent(JSON.stringify({}))}`,
  );
}

export async function assignRole(userId: string, roleName: string) {
  return await trpcFetch(`${TRPC}/assignRole`, {
    method: 'POST',
    body: JSON.stringify({ userId, roleName }),
  });
}

export async function getUserRole(userId: string) {
  const params = encodeURIComponent(JSON.stringify({ userId }));
  return await trpcFetch(`${TRPC}/getUserRole?input=${params}`);
}

export async function getAllRoles() {
  return await trpcFetch(`${TRPC}/getAllRoles?input=${encodeURIComponent(JSON.stringify({}))}`);
}

export async function getRole(roleId?: string, name?: string) {
  const params = encodeURIComponent(JSON.stringify({ roleId, name }));
  return await trpcFetch(`${TRPC}/getRole?input=${params}`);
}

export async function createRole(name: string, description: string, permissions: string[]) {
  return await trpcFetch(`${TRPC}/createRole`, {
    method: 'POST',
    body: JSON.stringify({ name, description, permissions }),
  });
}

export async function updateRole(name: string, description?: string, permissions?: string[]) {
  return await trpcFetch(`${TRPC}/updateRole`, {
    method: 'POST',
    body: JSON.stringify({ name, description, permissions }),
  });
}

export async function deleteRole(name: string) {
  return await trpcFetch(`${TRPC}/deleteRole`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
