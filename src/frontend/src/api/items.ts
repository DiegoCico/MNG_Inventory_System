import { me } from './auth';

const TRPC = '/trpc';

/** CREATE ITEM */
export async function createItem(
  teamId: string,
  name: string,
  actualName: string,
  nsn: string,
  serialNumber: string,
  imageBase64?: string,
  description?: string,
  parent?: string | null,
) {
  const currentUser = await me();

  const body = {
    teamId,
    name,
    actualName,
    nsn,
    serialNumber,
    userId: currentUser.userId,
    status: 'To Review',
    imageBase64,
    description,
    parent,
  };

  const res = await fetch(`${TRPC}/createItem`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`createItem failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data ?? {};
}

/** GET ALL ITEMS */
export async function getItems(teamId: string) {
  const currentUser = await me();

  const res = await fetch(
    `${TRPC}/getItems?input=${encodeURIComponent(
      JSON.stringify({ teamId, userId: currentUser.userId }),
    )}`,
    { method: 'GET', credentials: 'include' },
  );

  if (!res.ok) throw new Error(`getItems failed: ${res.status}`);
  const json = await res.json();
  console.log(json?.result?.data)
  return json?.result?.data ?? {};
}

/** GET SINGLE ITEM */
export async function getItem(teamId: string, itemId: string) {
  const currentUser = await me();

  const res = await fetch(
    `${TRPC}/getItem?input=${encodeURIComponent(
      JSON.stringify({ teamId, itemId, userId: currentUser.userId }),
    )}`,
    { method: 'GET', credentials: 'include' },
  );

  if (!res.ok) throw new Error(`getItem failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data ?? {};
}

/** UPDATE ITEM */
export async function updateItem(
  teamId: string,
  itemId: string,
  updates: {
    name?: string;
    actualName?: string;
    nsn?: string;
    serialNumber?: string;
    quantity?: number;
    description?: string;
    imageBase64?: string;
    status?: string;
    damageReports?: string[];
    parent?: string | null;
    notes?: string;
  },
) {
  const currentUser = await me();

  const payload = {
    teamId,
    itemId,
    userId: currentUser.userId,
    ...updates,
  };

  const res = await fetch(`${TRPC}/updateItem`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`updateItem failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data ?? {};
}

/** DELETE ITEM */
export async function deleteItem(teamId: string, itemId: string) {
  const currentUser = await me();

  const res = await fetch(`${TRPC}/deleteItem`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId,
      itemId,
      userId: currentUser.userId,
    }),
  });

  if (!res.ok) throw new Error(`deleteItem failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data ?? {};
}

/** UPLOAD IMAGE */
export async function uploadImage(teamId: string, nsn: string, imageBase64: string) {
  const res = await fetch(`${TRPC}/uploadImage`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId,
      nsn,
      imageBase64,
    }),
  });

  if (!res.ok) throw new Error(`uploadImage failed: ${res.status}`);
  const json = await res.json();

  return json?.imageKey ? { imageKey: json.imageKey } : (json?.result?.data ?? {});
}
