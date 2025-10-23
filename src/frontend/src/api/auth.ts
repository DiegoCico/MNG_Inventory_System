const TRPC = '/trpc';

export async function loginUser(email: string, password: string) {
  const res = await fetch(`${TRPC}/signIn`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }), 
  });
  if (!res.ok) throw new Error(`signIn failed: ${res.status}`);
  const json = await res.json();
  const data = json?.result?.data;
  if (!data) throw new Error('unexpected response');
  return data;
}

export async function completeNewPassword(session: string, newPassword: string, email: string) {
  const res = await fetch(`${TRPC}/respondToChallenge`, {
    method: 'POST',
    credentials: 'include',
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
  return json?.result?.data;
}

export async function refresh() {
  const res = await fetch(`${TRPC}/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), 
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

export async function logout() {
  const res = await fetch(`${TRPC}/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), 
  });
  if (!res.ok) throw new Error(`logout failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}

export async function me() {
  const res = await fetch(`${TRPC}/me?input=${encodeURIComponent('null')}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`me failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data as { authenticated: boolean; message: string };
}

export async function submitOtp(
  challengeName: 'EMAIL_OTP' | 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA',
  session: string,
  mfaCode: string,
  email: string,
) {
  const res = await fetch(`/trpc/respondToChallenge`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeName, session, mfaCode, email }),
  });
  if (!res.ok) throw new Error(`respondToChallenge failed: ${res.status}`);
  const json = await res.json();
  return json?.result?.data;
}
