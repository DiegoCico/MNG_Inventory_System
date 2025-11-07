const TRPC_URL = '/trpc';

export async function loadDashboard(teamId: string) {
  const res = await fetch(`${TRPC_URL}/getDashboard`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({teamId}), 
  });
  if (!res.ok) throw new Error(`getDashboard failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response');
  return data;
}