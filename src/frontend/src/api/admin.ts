const TRPC = '/trpc';

export async function listUsersWithRoles() {
  const res = await fetch(
    `${TRPC}/listUsersWithRoles?input=${encodeURIComponent(JSON.stringify({}))}`,
    {
      credentials: 'include',
    },
  );
  if (!res.ok) throw new Error(`listUsersWithRoles failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

export async function assignRole(userId: string, roleName: string) {
  const res = await fetch(`${TRPC}/assignRole`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roleName }),
  });
  if (!res.ok) throw new Error(`assignRole failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

export async function getUserRole(userId: string) {
  const params = encodeURIComponent(JSON.stringify({ userId }));
  const res = await fetch(`${TRPC}/getUserRole?input=${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`getUserRole failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

export async function getAllRoles() {
  const res = await fetch(`${TRPC}/getAllRoles?input=${encodeURIComponent(JSON.stringify({}))}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`getAllRoles failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

export async function getRole(roleId?: string, name?: string) {
  const params = encodeURIComponent(JSON.stringify({ roleId, name }));
  const res = await fetch(`${TRPC}/getRole?input=${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`getRole failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

export async function createRole(name: string, description: string, permissions: string[]) {
  const res = await fetch(`${TRPC}/createRole`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, permissions }),
  });
  if (!res.ok) throw new Error(`createRole failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

export async function updateRole(name: string, description?: string, permissions?: string[]) {
  const res = await fetch(`${TRPC}/updateRole`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, permissions }),
  });
  if (!res.ok) throw new Error(`updateRole failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

export async function deleteRole(name: string) {
  const res = await fetch(`${TRPC}/deleteRole`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`deleteRole failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}
