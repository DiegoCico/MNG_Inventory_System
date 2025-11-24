import { trpcFetch } from './utils';

const TRPC_URL = '/trpc';
const HEALTH_URL = '/health';

export async function getHelloMessage() {
  // tRPC query: GET with ?input=null
  const data: { message?: string } = await trpcFetch(`${TRPC_URL}/hello?input=null`);
  return data?.message ?? 'no message';
}

export async function getItem(itemId?: string) {
  const input = itemId ? encodeURIComponent(JSON.stringify({ itemId })) : 'null';
  return (await trpcFetch(`${TRPC_URL}/getItem?input=${input}`)) ?? null;
}

export async function getInventoryForm(teamId?: string, nsn?: string) {
  if (!nsn) throw new Error('NSN is required');

  const input = encodeURIComponent(JSON.stringify({ teamId, nsn }));
  return (await trpcFetch(`${TRPC_URL}/s3.getInventoryForm?input=${input}`)) ?? null;
}

export async function checkHealth() {
  const r = await fetch(HEALTH_URL);
  return r.ok;
}
