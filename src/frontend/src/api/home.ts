const TRPC_URL = '/trpc';

export async function loadDashboard(teamId: string) {
  const params = encodeURIComponent(JSON.stringify({ teamId }));
  const res = await fetch(`${TRPC_URL}/getDashboard?input=${params}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`getDashboard failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

/** New function: soft reset all items for a team */
export async function softReset(teamId: string) {
  const res = await fetch(`${TRPC_URL}/softReset`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ teamId }),
  });

  if (!res.ok) throw new Error(`softReset failed: ${res.status}`);

  const json = await res.json();
  return json?.result?.data;
}
