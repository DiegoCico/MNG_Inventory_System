/* eslint-disable @typescript-eslint/no-explicit-any */
const TRPC = '/trpc';

export async function updateProfile(userId: string, name?: string, role?: string) {
  const body: Record<string, any> = { userId };
  if (name) body.name = name;
  if (role) body.role = role;

  const res = await fetch(`${TRPC}/updateProfile`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`updateProfile failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response from updateProfile');
  return data;
}

export async function getProfileImage(userId: string) {
  const input = encodeURIComponent(JSON.stringify({ userId }));
  const res = await fetch(`${TRPC}/getProfileImage?input=${input}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`getProfileImage failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response from getProfileImage');
  const email = String(data?.email ?? '');
  const safeName = email.includes('@') ? email.split('@')[0] : email || 'user';
  return { ...data, safeName };
}

export async function uploadProfileImage(userId: string, dataUrl: string) {
  const res = await fetch(`${TRPC}/uploadProfileImage`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, dataUrl }),
  });
  if (!res.ok) throw new Error(`uploadProfileImage failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response from uploadProfileImage');
  return data; // { key, url }
}
