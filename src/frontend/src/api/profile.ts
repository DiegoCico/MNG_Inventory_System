/* eslint-disable @typescript-eslint/no-explicit-any */
const TRPC = '/trpc';

export async function updateProfile(userId: string, name: string, username: string) {
  const res = await fetch(`${TRPC}/updateProfile`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, name, username }),
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

  const username = data?.username || 'user';

  return { ...data, safeName: username };
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
