export async function trpcFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const json = await res.json();

  if (!res.ok) {
    // tRPC returns errors in this shape: { error: { message: "...", code: -32603, data: ... } }
    const serverMessage = json?.error?.message || json?.error?.data?.message;

    // Throw a standard Error with the server's specific message so the UI can display it
    throw new Error(serverMessage || `Request failed: ${res.status}`);
  }

  // tRPC returns data in: { result: { data: ... } }
  return json?.result?.data;
}
