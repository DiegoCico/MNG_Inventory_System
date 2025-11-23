import { trpcFetch } from './utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TRPC = '/trpc';

export async function updateProfile(userId: string, name: string, username: string) {
  const data = await trpcFetch(`${TRPC}/updateProfile`, {
    method: 'POST',
    body: JSON.stringify({ userId, name, username }),
  });

  if (!data) throw new Error('unexpected response from updateProfile');
  return data;
}

export async function getProfileImage(userId: string) {
  const input = encodeURIComponent(JSON.stringify({ userId }));
  const data: any = await trpcFetch(`${TRPC}/getProfileImage?input=${input}`, {
    method: 'GET',
  });

  if (!data) throw new Error('unexpected response from getProfileImage');

  const username = data?.username || 'user';

  return { ...data, safeName: username };
}

export async function uploadProfileImage(userId: string, dataUrl: string) {
  const data = await trpcFetch(`${TRPC}/uploadProfileImage`, {
    method: 'POST',
    body: JSON.stringify({ userId, dataUrl }),
  });

  if (!data) throw new Error('unexpected response from uploadProfileImage');

  return data; // { key, url }
}
