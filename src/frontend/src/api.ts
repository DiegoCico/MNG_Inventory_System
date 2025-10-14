const TRPC_URL = '/trpc';
const HEALTH_URL = '/health';

export async function getHelloMessage() {
  // tRPC query: GET with ?input=null
  const r = await fetch(`${TRPC_URL}/hello?input=null`);
  if (!r.ok) throw new Error(`hello failed: ${r.status}`);
  const j = await r.json();
  return j?.result?.data?.message ?? 'no message';
}

export async function checkHealth() {
  const r = await fetch(HEALTH_URL);
  return r.ok;
}
