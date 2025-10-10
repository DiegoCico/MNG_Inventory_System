const BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3001"
    : window.location.origin; // same-origin in production

const TRPC_URL = `${BASE}/trpc`;
const HEALTH_URL = `${BASE}/health`;

export async function getHelloMessage() {
  const res = await fetch(`${TRPC_URL}/hello?input=null`, { credentials: "include" });
  const json = await res.json();
  return json?.result?.data?.message ?? "no message";
}

export async function checkHealth() {
  const res = await fetch(HEALTH_URL);
  return res.ok;
}
