const TRPC_URL = '/trpc';
const HEALTH_URL = '/health';

export async function getHelloMessage() {
  // tRPC query: GET with ?input=null
  const r = await fetch(`${TRPC_URL}/hello?input=null`);
  if (!r.ok) throw new Error(`hello failed: ${r.status}`);
  const j = await r.json();
  return j?.result?.data?.message ?? 'no message';
}

export async function getItem(itemId?: string) {
  const input = itemId ? encodeURIComponent(JSON.stringify({ itemId })) : 'null';
  const r = await fetch(`${TRPC_URL}/getItem?input=${input}`);
  if (!r.ok) throw new Error(`getItem failed: ${r.status}`);
  const j = await r.json();
  return j?.result?.data ?? null;
}

export async function getInventoryForm(teamId?: string, nsn?: string) {
  if (!nsn) throw new Error('NSN is required');

  const input = encodeURIComponent(JSON.stringify({ teamId, nsn }));
  const r = await fetch(`${TRPC_URL}/s3.getInventoryForm?input=${input}`);
  if (!r.ok) throw new Error(`getInventoryForm failed: ${r.status}`);
  const j = await r.json();
  return j?.result?.data ?? null;
}

export async function checkHealth() {
  const r = await fetch(HEALTH_URL);
  return r.ok;
}
