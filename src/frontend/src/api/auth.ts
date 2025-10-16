const TRPC = '/trpc'

export async function loginUser(email: string, password: string) {
  const res = await fetch(`${TRPC}/signIn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response');
  return data; // if challenge: { success:false, challengeName, session, ... }
}

export async function completeNewPassword(
  session: string,
  newPassword: string,
  email: string,
) {
  const res = await fetch(`${TRPC}/respondToChallenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session,
      newPassword,
      email,
    }),
  });
 
  if (!res.ok) throw new Error(`respondToChallenge failed: ${res.status}`);
  const json = await res.json();
 
  // tRPC success shape
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response');
  return data; // { success, accessToken, idToken, ... }
}