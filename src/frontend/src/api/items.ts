import { me } from "./auth";

const TRPC = "/trpc";

/** 🟢 CREATE ITEM */
export async function createItem(
  teamId: string,
  name: string,
  actualName: string,
  nsn: string,
  serialNumber: string,
  imageLink?: string,
  description?: string,
  parent?: string | null
) {
  const currentUser = await me();

  const body = {
    teamId,
    name,
    actualName,
    nsn,
    serialNumber,
    userId: currentUser.userId,
    status: "To Review",
    imageLink,
    description,
    parent,
  };

  console.log("[createItem] body:", body);

  const res = await fetch(`${TRPC}/createItem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  console.log("[createItem] response:", res.status);
  if (!res.ok) throw new Error(`createItem failed: ${res.status}`);
  const json = await res.json();
  console.log("[createItem] json:", json);
  return json?.result?.data ?? {};
}


/** 🟢 GET ALL ITEMS */
export async function getItems(teamId: string) {
  const currentUser = await me();
  console.log("[getItems] for user:", currentUser);

  const res = await fetch(
    `${TRPC}/getItems?input=${encodeURIComponent(
      JSON.stringify({ teamId, userId: currentUser.userId })
    )}`,
    { method: "GET", credentials: "include" }
  );

  console.log("[getItems] response:", res.status);
  if (!res.ok) throw new Error(`getItems failed: ${res.status}`);
  const json = await res.json();
  console.log("[getItems] json:", json);
  return json?.result?.data ?? {};
}

/** 🟢 GET SINGLE ITEM */
export async function getItem(teamId: string, itemId: string) {
  const currentUser = await me();
  console.log("[getItem] for user:", currentUser);

  const res = await fetch(
    `${TRPC}/getItem?input=${encodeURIComponent(
      JSON.stringify({ teamId, itemId, userId: currentUser.userId })
    )}`,
    { method: "GET", credentials: "include" }
  );

  console.log("[getItem] response:", res.status);
  if (!res.ok) throw new Error(`getItem failed: ${res.status}`);
  const json = await res.json();
  console.log("[getItem] json:", json);
  return json?.result?.data ?? {};
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
    notes?: string;
  }
) {
  const currentUser = await me();
  const payload = {
    teamId,
    itemId,
    userId: currentUser.userId,
    ...updates,
  };

  console.log("[updateItem] payload:", payload);

  const res = await fetch(`${TRPC}/updateItem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  console.log("[updateItem] response:", res.status);
  if (!res.ok) throw new Error(`updateItem failed: ${res.status}`);
  const json = await res.json();
  console.log("[updateItem] json:", json);
  return json?.result?.data ?? {};
}

/** 🟢 DELETE ITEM */
export async function deleteItem(teamId: string, itemId: string) {
  const currentUser = await me();
  console.log("[deleteItem] deleting:", itemId);

  const res = await fetch(`${TRPC}/deleteItem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamId,
      itemId,
      userId: currentUser.userId,
    }),
  });

  console.log("[deleteItem] response:", res.status);
  if (!res.ok) throw new Error(`deleteItem failed: ${res.status}`);
  const json = await res.json();
  console.log("[deleteItem] json:", json);
  return json?.result?.data ?? {};
}

/** 🟢 UPLOAD IMAGE */
export async function uploadImage(
  teamId: string,
  nsn: string,
  imageBase64: string
) {
  console.log("[uploadImage] uploading for nsn:", nsn);

  const res = await fetch(`${TRPC}/uploadImage`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamId,
      nsn,
      imageBase64,
    }),
  });

  console.log("[uploadImage] response:", res.status);
  if (!res.ok) throw new Error(`uploadImage failed: ${res.status}`);
  const json = await res.json();
  console.log("[uploadImage] json:", json);
  return json?.imageLink
    ? { imageLink: json.imageLink }
    : json?.result?.data ?? {};

}
