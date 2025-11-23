import { trpcFetch } from './utils';

const TRPC = '/trpc';

/* CREATE TEAMSPACE */
export async function createTeamspace(
  name: string,
  description: string,
  userId: string,
  uic: string,
  fe: string,
) {
  return await trpcFetch('/trpc/createTeamspace', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      userId,
      uic,
      fe,
    }),
  });
}

/* GET TEAMSPACE */
export async function getTeamspace(userId: string) {
  const data = await trpcFetch(
    `${TRPC}/getTeamspace?input=${encodeURIComponent(JSON.stringify({ userId }))}`,
    {
      method: 'GET',
    },
  );

  if (!data) throw new Error('unexpected response from getTeamspace');
  return data;
}

/* ADD USER (BY USERNAME, NOT EMAIL) */
export async function addUserTeamspace(
  userId: string,
  memberUsername: string,
  teamspaceId: string,
) {
  const data = await trpcFetch(`${TRPC}/addUserTeamspace`, {
    method: 'POST',
    body: JSON.stringify({
      userId,
      memberUsername,
      inviteWorkspaceId: teamspaceId,
    }),
  });

  if (!data) throw new Error('unexpected response from addUserTeamspace');
  return data;
}

/* REMOVE USER */
export async function removeUserTeamspace(
  userId: string,
  memberUsername: string,
  teamspaceId: string,
) {
  const data = await trpcFetch(`${TRPC}/removeUserTeamspace`, {
    method: 'POST',
    body: JSON.stringify({
      userId,
      memberUsername,
      inviteWorkspaceId: teamspaceId,
    }),
  });

  if (!data) throw new Error('unexpected response from removeUserTeamspace');
  return data;
}

/* DELETE TEAMSPACE */
export async function deleteTeamspace(teamspaceId: string, userId: string) {
  const data = await trpcFetch(`${TRPC}/deleteTeamspace`, {
    method: 'POST',
    body: JSON.stringify({ inviteWorkspaceId: teamspaceId, userId }),
  });

  if (!data) throw new Error('unexpected response from deleteTeamspace');
  return data;
}

/* GET ALL USERS */
export async function getAllUsers() {
  const data = await trpcFetch(`${TRPC}/getAllUsers`, {
    method: 'GET',
  });

  if (!data) throw new Error('unexpected response from getAllUsers');
  return data;
}
