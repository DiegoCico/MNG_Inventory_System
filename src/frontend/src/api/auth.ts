import { trpcFetch } from './utils';

const TRPC = '/trpc';

export async function loginUser(email: string, password: string) {
  return await trpcFetch(`${TRPC}/signIn`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function inviteUser(email: string) {
  return await trpcFetch(`${TRPC}/inviteUser`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function completeNewPassword(session: string, newPassword: string, email: string) {
  return await trpcFetch(`${TRPC}/respondToChallenge`, {
    method: 'POST',
    body: JSON.stringify({
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session,
      newPassword,
      email,
    }),
  });
}

export async function refresh() {
  return await trpcFetch(`${TRPC}/refresh`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function logout() {
  return await trpcFetch(`${TRPC}/logout`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function me() {
  try {
    const data = (await trpcFetch(`${TRPC}/me?input=${encodeURIComponent(JSON.stringify(null))}`, {
      method: 'GET',
    })) as {
      userId: string;
      name: string;
      username: string;
      role: string;
      authenticated: boolean;
    };

    if (!data || data.authenticated === false) {
      if (window.location.pathname !== '/signin') {
        window.location.href = '/signin';
      }
      throw new Error('unauthenticated');
    }

    return {
      userId: data.userId,
      name: data.name,
      username: data.username,
      role: data.role,
      authenticated: true,
    };
  } catch (error) {
    console.error('[me] failed, redirecting to /signin:', error);
    if (window.location.pathname !== '/signin') {
      window.location.href = '/signin';
    }
    throw error;
  }
}

export async function submitOtp(
  challengeName: 'EMAIL_OTP' | 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA',
  session: string,
  mfaCode: string,
  email: string,
) {
  return await trpcFetch(`/trpc/respondToChallenge`, {
    method: 'POST',
    body: JSON.stringify({ challengeName, session, mfaCode, email }),
  });
}
