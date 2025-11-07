const TRPC = "/trpc";

export async function createItem(
  teamId: string,
  name: string,
  actualName: string,
  nsn: string,
  serialNumber: string,
  userId: string
) {
  const res = await fetch(`${TRPC}/items.createItem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamId,
      name,
      actualName,
      nsn,
      serialNumber,
      userId,
      status: 'Incomplete'
    }),
  });
  if (!res.ok) throw new Error(`createItem failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from createItem");
  return data;
}

export async function getItems(teamId: string) {
  const res = await fetch(
    `${TRPC}/items.getItems?input=${encodeURIComponent(JSON.stringify({ teamId, userId: 'test-user' }))}`,
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

export async function getItem(teamId: string, itemId: string) {
  const res = await fetch(
    `${TRPC}/items.getItem?input=${encodeURIComponent(JSON.stringify({ teamId, itemId, userId: 'test-user' }))}`,
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
  }
) {
  const res = await fetch(`${TRPC}/items.updateItem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, itemId, userId: 'test-user', ...updates }),
  });
  if (!res.ok) throw new Error(`updateItem failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from updateItem");
  return data;
}

export async function deleteItem(teamId: string, itemId: string) {
  const res = await fetch(`${TRPC}/items.deleteItem`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, itemId, userId: 'test-user' }),
  });
  if (!res.ok) throw new Error(`deleteItem failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from deleteItem");
  return data;
}
