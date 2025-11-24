import { trpcFetch } from './utils';

const TRPC_URL = '/trpc';

/** Get team by ID */
export async function getTeam(teamId: string, userId: string) {
  const params = encodeURIComponent(JSON.stringify({ teamId, userId }));
  return await trpcFetch(`${TRPC_URL}/getTeamById?input=${params}`, {
    method: 'GET',
  });
}

/** New function: soft reset all items for a team */
export async function softReset(teamId: string) {
  return await trpcFetch(`${TRPC_URL}/softReset`, {
    method: 'POST',
    body: JSON.stringify({ teamId }),
  });
}
