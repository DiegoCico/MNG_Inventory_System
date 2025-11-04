import type { Response } from 'express';
import * as cookie from 'cookie';

export interface AuthTokens {
  AccessToken: string | null;
  IdToken: string | null;
  RefreshToken?: string | null;
  ExpiresIn?: number | null;
}

export const COOKIE_ACCESS = 'auth_access';
export const COOKIE_ID = 'auth_id';
export const COOKIE_REFRESH = 'auth_refresh';

// Choose safe defaults:
// - production: cross-site → SameSite=None + Secure=true (required by browsers)
// - development: http://localhost same-site → SameSite=Lax + Secure=false
const IS_PROD = process.env.NODE_ENV === 'production';
const DEFAULT_SAMESITE = (IS_PROD ? 'none' : 'lax') as 'none' | 'lax' | 'strict';
const DEFAULT_SECURE = IS_PROD;

function baseCookieOpts(maxAge?: number) {
  return {
    httpOnly: true as const,
    secure: DEFAULT_SECURE,
    sameSite: DEFAULT_SAMESITE,
    path: '/' as const,
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  };
}

/** Serialize a cookie, omitting undefined values. */
function serializeCookie(name: string, value: string, maxAge?: number) {
  return cookie.serialize(name, value, baseCookieOpts(maxAge));
}

/** Serialize an immediate-expiry cookie to clear it. */
function serializeClear(name: string) {
  // Use Max-Age=0 and an epoch Expires to be extra-safe across browsers/CDNs.
  return cookie.serialize(name, '', {
    ...baseCookieOpts(0),
    expires: new Date(0),
  });
}

/**
 * Build Set-Cookie headers for a successful sign-in.
 * - Access/ID cookies live for ExpiresIn (default 3600s).
 * - Refresh cookie (if provided) lives for 1 day.
 */
export function buildAuthSetCookies(tokens: AuthTokens): string[] {
  const headers: string[] = [];
  const accessTtl = tokens.ExpiresIn ?? 3600; // seconds
  const idTtl = tokens.ExpiresIn ?? 3600; // seconds
  const refreshTtl = 60 * 60 * 24; // 1 day

  if (tokens.AccessToken) {
    headers.push(serializeCookie(COOKIE_ACCESS, tokens.AccessToken, accessTtl));
  }
  if (tokens.IdToken) {
    headers.push(serializeCookie(COOKIE_ID, tokens.IdToken, idTtl));
  }
  if (tokens.RefreshToken) {
    headers.push(serializeCookie(COOKIE_REFRESH, tokens.RefreshToken, refreshTtl));
  }

  return headers;
}

/** Build Set-Cookie headers that clear all auth cookies. */
export function buildAuthClearCookies(): string[] {
  return [serializeClear(COOKIE_ACCESS), serializeClear(COOKIE_ID), serializeClear(COOKIE_REFRESH)];
}

/**
 * Convenience: directly set cookies on an Express Response **and** return the headers.
 * Safe to call even if `res` is undefined (e.g., when used under API Gateway adapter).
 */
export function setAuthCookies(res: Response | undefined, tokens: AuthTokens): string[] {
  const headers = buildAuthSetCookies(tokens);
  if (res && headers.length) {
    // If multiple Set-Cookie headers already exist, append
    const existing = res.getHeader('Set-Cookie');
    const arr = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
    res.setHeader('Set-Cookie', [...arr, ...headers]);
  }
  return headers;
}

/** Convenience: clear cookies on an Express Response and return the headers. */
export function clearAuthCookies(res?: Response): string[] {
  const headers = buildAuthClearCookies();
  if (res) {
    const existing = res.getHeader('Set-Cookie');
    const arr = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
    res.setHeader('Set-Cookie', [...arr, ...headers]);
  }
  return headers;
}

/** Parse cookie header string into a map. */
export function parseCookieHeader(header: string | undefined | null): Record<string, string> {
  if (!header) return {};
  try {
    return cookie.parse(header);
  } catch {
    return {};
  }
}

// ---- Helpers for Lambda/Express cookie parsing & emission ----

export type CtxLike = {
  req?: { headers?: Record<string, unknown> };
  event?: { headers?: Record<string, string | undefined>; cookies?: string[] };
  responseCookies?: string[];
};

/**
 * Build a single Cookie header string from either Express req or API Gateway v2 event.
 * Supports event.cookies array and Cookie/cookie headers.
 */
export function cookieHeaderFromCtx(ctx?: CtxLike): string {
  const parts: string[] = [];
  const fromArray = Array.isArray(ctx?.event?.cookies) ? ctx!.event!.cookies : [];
  if (fromArray.length) parts.push(...fromArray);

  const headerLower = ctx?.event?.headers?.cookie as string | undefined;
  const headerUpper = (ctx?.event?.headers as Record<string, string> | undefined)?.Cookie;
  const headerReq = ctx?.req && (ctx.req.headers as Record<string, string> | undefined)?.cookie;
  const header = headerLower ?? headerUpper ?? headerReq;
  if (header) parts.push(header);

  return parts.length ? parts.join('; ') : '';
}

/** Parse cookies directly from context (Express or Lambda) */
export function parseCookiesFromCtx(ctx?: CtxLike): Record<string, string> {
  const header = cookieHeaderFromCtx(ctx);
  return header ? parseCookieHeader(header) : {};
}

/** Utility to push Set-Cookie strings to Lambda adapter context */
export function emitCookiesToLambda(ctx: CtxLike | undefined, headers: string[] | undefined) {
  if (!headers || headers.length === 0) return;
  ctx?.responseCookies?.push(...headers);
}
