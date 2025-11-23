const TRPC = '/trpc';

/* CREATE TEAMSPACE */
export async function createTeamspace(
  name: string,
  description: string,
  userId: string,
  uic: string,
  fe: string
) {
  const res = await fetch('/trpc/createTeamspace', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description,
      userId,
      uic,
      fe,
    }),
  });

  if (!res.ok) throw new Error(`createTeamspace failed: ${res.status}`);

  const json = await res.json();
  return json?.result?.data;
}


/* GET TEAMSPACE */
export async function getTeamspace(userId: string) {
  const res = await fetch(
    `${TRPC}/getTeamspace?input=${encodeURIComponent(JSON.stringify({ userId }))}`,
    {
      method: 'GET',
      credentials: 'include',
    },
  );

  if (!res.ok) throw new Error(`getTeamspace failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response from getTeamspace');
  return data;
}

/* ADD USER (BY USERNAME, NOT EMAIL) */
export async function addUserTeamspace(
  userId: string,
  memberUsername: string,
  teamspaceId: string,
) {
  const res = await fetch(`${TRPC}/addUserTeamspace`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      memberUsername,
      inviteWorkspaceId: teamspaceId,
    }),
  });

  if (!res.ok) throw new Error(`addUserTeamspace failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response from addUserTeamspace');
  return data;
}

/* REMOVE USER */
export async function removeUserTeamspace(
  userId: string,
  memberUsername: string,
  teamspaceId: string,
) {
  const res = await fetch(`${TRPC}/removeUserTeamspace`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      memberUsername,
      inviteWorkspaceId: teamspaceId,
    }),
  });

  if (!res.ok) throw new Error(`removeUserTeamspace failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response from removeUserTeamspace');
  return data;
}

/* DELETE TEAMSPACE */
export async function deleteTeamspace(teamspaceId: string, userId: string) {
  const res = await fetch(`${TRPC}/deleteTeamspace`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteWorkspaceId: teamspaceId, userId }),
  });

  if (!res.ok) throw new Error(`deleteTeamspace failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response from deleteTeamspace');
  return data;
}

/* GET ALL USERS */
export async function getAllUsers() {
  const res = await fetch(`${TRPC}/getAllUsers`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) throw new Error(`getAllUsers failed: ${res.status}`);

  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response from getAllUsers');
  console.log(data);
  return data;
}