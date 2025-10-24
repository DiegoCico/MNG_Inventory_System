const TRPC = "/trpc";

/** Helper: Logs request + response metadata for easier debugging. */
async function debugFetch(endpoint: string, options: RequestInit) {
  console.log(`🟦 [FETCH → ${endpoint}]`, {
    method: options.method,
    credentials: options.credentials,
    headers: options.headers,
    body: options.body,
  });

  const res = await fetch(endpoint, options);

  // Log response headers and cookies (if visible)
  const cookieHeader = res.headers.get("set-cookie");
  console.log(`🟩 [FETCH ← ${endpoint}]`, {
    status: res.status,
    ok: res.ok,
    url: res.url,
    setCookie: cookieHeader,
  });

  const json = await res.json().catch(() => null);
  console.log(`📦 [FETCH JSON ← ${endpoint}]`, json);
  return { res, json };
}

/* -------------------------------------------------------------------------- */
/*                                 AUTH CALLS                                 */
/* -------------------------------------------------------------------------- */

export async function loginUser(email: string, password: string) {
  const { res, json } = await debugFetch(`${TRPC}/signIn`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error(`signIn failed: ${res.status}`);
  const data = json?.result?.data;
  if (!data) throw new Error("unexpected response");
  return data;
}

export async function completeNewPassword(
  session: string,
  newPassword: string,
  email: string
) {
  const { res, json } = await debugFetch(`${TRPC}/respondToChallenge`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeName: "NEW_PASSWORD_REQUIRED",
      session,
      newPassword,
      email,
    }),
  });

  if (!res.ok) throw new Error(`respondToChallenge failed: ${res.status}`);
  return json?.result?.data;
}

export async function refresh() {
  const { res, json } = await debugFetch(`${TRPC}/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  return json?.result?.data;
}

export async function logout() {
  const { res, json } = await debugFetch(`${TRPC}/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error(`logout failed: ${res.status}`);
  return json?.result?.data;
}

export async function me() {
  const { res, json } = await debugFetch(
    `${TRPC}/me?input=${encodeURIComponent("null")}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!res.ok) throw new Error(`me failed: ${res.status}`);
  return json?.result?.data as { authenticated: boolean; message: string };
}

export async function submitOtp(
  challengeName: "EMAIL_OTP" | "SMS_MFA" | "SOFTWARE_TOKEN_MFA",
  session: string,
  mfaCode: string,
  email: string
) {
  const { res, json } = await debugFetch(`${TRPC}/respondToChallenge`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeName, session, mfaCode, email }),
  });

  if (!res.ok) throw new Error(`respondToChallenge failed: ${res.status}`);
  return json?.result?.data;
}
