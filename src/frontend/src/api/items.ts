import { trpcFetch } from './utils';
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

  return (
    (await trpcFetch(`${TRPC}/createItem`, {
      method: 'POST',
      body: JSON.stringify(body),
    })) ?? {}
  );
}

/** GET ALL ITEMS */
export async function getItems(teamId: string) {
  const currentUser = await me();

  const data = await trpcFetch(
    `${TRPC}/getItems?input=${encodeURIComponent(
      JSON.stringify({ teamId, userId: currentUser.userId }),
    )}`,
    { method: 'GET' },
  );
  // console.log(data);
  return data ?? {};
}

/** GET SINGLE ITEM */
export async function getItem(teamId: string, itemId: string) {
  const currentUser = await me();

  return (
    (await trpcFetch(
      `${TRPC}/getItem?input=${encodeURIComponent(
        JSON.stringify({ teamId, itemId, userId: currentUser.userId }),
      )}`,
      { method: 'GET' },
    )) ?? {}
  );
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

  return (
    (await trpcFetch(`${TRPC}/updateItem`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })) ?? {}
  );
}

/** DELETE ITEM */
export async function deleteItem(teamId: string, itemId: string) {
  const currentUser = await me();

  return (
    (await trpcFetch(`${TRPC}/deleteItem`, {
      method: 'POST',
      body: JSON.stringify({
        teamId,
        itemId,
        userId: currentUser.userId,
      }),
    })) ?? {}
  );
}

/** UPLOAD IMAGE */
export async function uploadImage(teamId: string, nsn: string, imageBase64: string) {
  interface UploadImageResponse {
    imageKey?: string;
  }

  const data: UploadImageResponse = await trpcFetch(`${TRPC}/uploadImage`, {
    method: 'POST',
    body: JSON.stringify({
      teamId,
      nsn,
      imageBase64,
    }),
  });

  return data?.imageKey ? { imageKey: data.imageKey } : (data ?? {});
}
