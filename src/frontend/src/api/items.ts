import { me } from "./auth";

const TRPC = "/trpc";

/** 🟢 CREATE ITEM */
export async function createItem(
  teamId: string,
  name: string,
  actualName: string,
  nsn: string,
  serialNumber: string,
  userId?: string,
  imageLink?: string
) {
  const currentUser = userId ? { userId } : await me();

  const res = await fetch(`${TRPC}/createItem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        teamId,
        name,
        actualName,
        nsn,
        serialNumber,
        userId: currentUser?.userId,
        status: "Incomplete",
        imageLink,
      },
    }),
  });

  if (!res.ok) throw new Error(`createItem failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from createItem");
  return data;
}

/** 🟢 GET ALL ITEMS */
export async function getItems(teamId: string) {
  const currentUser = await me();
  const res = await fetch(
    `${TRPC}/getItems?input=${encodeURIComponent(
      JSON.stringify({ teamId, userId: currentUser.userId })
    )}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!res.ok) throw new Error(`getItems failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from getItems");
  return data;
}

/** 🟢 GET SINGLE ITEM */
export async function getItem(teamId: string, itemId: string) {
  const currentUser = await me();
  const res = await fetch(
    `${TRPC}/getItem?input=${encodeURIComponent(
      JSON.stringify({ teamId, itemId, userId: currentUser.userId })
    )}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!res.ok) throw new Error(`getItem failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from getItem");
  return data;
}

/** 🟢 UPDATE ITEM */
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
    imageLink?: string;
    status?: string;
    damageReports?: string[];
    parent?: string | null; 
  }
) {
  const currentUser = await me();

  const res = await fetch(`${TRPC}/updateItem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        teamId,
        itemId,
        userId: currentUser.userId,
        ...updates,
      },
    }),
  });

  if (!res.ok) throw new Error(`updateItem failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from updateItem");
  return data;
}

/** 🟢 DELETE ITEM */
export async function deleteItem(teamId: string, itemId: string) {
  const currentUser = await me();
  const res = await fetch(`${TRPC}/deleteItem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        teamId,
        itemId,
        userId: currentUser.userId,
      },
    }),
  });

  if (!res.ok) throw new Error(`deleteItem failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from deleteItem");
  return data;
}

/** 🟢 UPLOAD IMAGE */
export async function uploadImage(
  teamId: string,
  nsn: string,
  imageBase64: string
) {
  const res = await fetch(`${TRPC}/uploadImage`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { teamId, nsn, imageBase64 },
    }),
  });

  if (!res.ok) throw new Error(`uploadImage failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from uploadImage");
  return data;
}
