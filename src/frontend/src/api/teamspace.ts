const TRPC = "/trpc";

export async function createTeamspace(
  name: string,
  description: string,
  userId: string
) {
  const res = await fetch(`${TRPC}/createTeamspace`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, userId }),
  });

  if (!res.ok) throw new Error(`createTeamspace failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from createTeamspace");
  return data;
}

export async function getTeamspace(userId: string) {
  const res = await fetch(
    `${TRPC}/getTeamspace?input=${encodeURIComponent(JSON.stringify({ userId }))}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!res.ok) throw new Error(`getTeamspace failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from getTeamspace");
  return data;
}

export async function addUserTeamspace(
  userId: string,
  userEmail: string,
  teamspaceId: string
) {
  const res = await fetch(`${TRPC}/addUserTeamspace`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, userEmail, teamspaceId }),
  });

  if (!res.ok) throw new Error(`addUserTeamspace failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from addUserTeamspace");
  return data;
}

export async function removeUserTeamspace(
  userId: string,
  userEmail: string,
  teamspaceId: string
) {
  const res = await fetch(`${TRPC}/removeUserTeamspace`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, userEmail, teamspaceId }),
  });

  if (!res.ok) throw new Error(`removeUserTeamspace failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from removeUserTeamspace");
  return data;
}

export async function deleteTeamspace(teamspaceId: string, userId: string) {
  const res = await fetch(`${TRPC}/deleteTeamspace`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamspaceId, userId }),
  });

  if (!res.ok) throw new Error(`deleteTeamspace failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response from deleteTeamspace");
  return data;
}
