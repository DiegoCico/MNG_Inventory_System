const TRPC = '/trpc';

// ============= USERS API =============

export async function listUsersWithRoles() {
  const res = await fetch(
    `${TRPC}/users.listUsersWithRoles?input=${encodeURIComponent(JSON.stringify({}))}`,
    {
      credentials: 'include',
    },
  );
  if (!res.ok) throw new Error(`listUsersWithRoles failed: ${res.status}`);
  return (await res.json())?.result?.data;
}

export async function assignRole(userId: string, roleName: string) {
  const res = await fetch(`${TRPC}/users.assignRole`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roleName }),
  });
  if (!res.ok) throw new Error(`assignRole failed: ${res.status}`);
  return (await res.json())?.result?.data;
}

export async function getUserRole(userId: string) {
  const params = encodeURIComponent(JSON.stringify({ userId }));
  const res = await fetch(`${TRPC}/users.getUserRole?input=${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`getUserRole failed: ${res.status}`);
  return (await res.json())?.result?.data;
}

// ============= ROLES API =============

export async function getAllRoles() {
  const res = await fetch(
    `${TRPC}/roles.getAllRoles?input=${encodeURIComponent(JSON.stringify({}))}`,
    {
      credentials: 'include',
    },
  );
  if (!res.ok) throw new Error(`getAllRoles failed: ${res.status}`);
  return (await res.json())?.result?.data;
}

export async function getRole(roleId?: string, name?: string) {
  const params = encodeURIComponent(JSON.stringify({ roleId, name }));
  const res = await fetch(`${TRPC}/roles.getRole?input=${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`getRole failed: ${res.status}`);
  return (await res.json())?.result?.data;
}

export async function createRole(name: string, description: string, permissions: string[]) {
  const res = await fetch(`${TRPC}/roles.createRole`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, permissions }),
  });
  if (!res.ok) throw new Error(`createRole failed: ${res.status}`);
  return (await res.json())?.result?.data;
}

export async function updateRole(
  roleId: string,
  name?: string,
  description?: string,
  permissions?: string[],
) {
  const res = await fetch(`${TRPC}/roles.updateRole`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId, name, description, permissions }),
  });
  if (!res.ok) throw new Error(`updateRole failed: ${res.status}`);
  return (await res.json())?.result?.data;
}

export async function deleteRole(roleId: string) {
  const res = await fetch(`${TRPC}/roles.deleteRole`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId }),
  });
  if (!res.ok) throw new Error(`deleteRole failed: ${res.status}`);
  return (await res.json())?.result?.data;
}
