import type { Response } from 'express';
import * as cookie from 'cookie';

// ===========================================================
//                        Configuration
// ===========================================================

export const COOKIE_ACCESS = 'auth_access';
export const COOKIE_ID = 'auth_id';
export const COOKIE_REFRESH = 'auth_refresh';
const DEFAULT_TOKEN_TTL = 3600; // 1 hour in seconds
const REFRESH_TOKEN_TTL = 60 * 60 * 24; // 1 day in seconds

// Production: SameSite=None + Secure=true | Development: SameSite=Lax + Secure=false
const IS_PROD = process.env.NODE_ENV === 'production';
const DEFAULT_SAMESITE = (IS_PROD ? 'none' : 'lax') as 'none' | 'lax' | 'strict';
const DEFAULT_SECURE = IS_PROD;


// ===========================================================
//                           Types
// ===========================================================

export interface AuthTokens {
  AccessToken: string | null;
  IdToken: string | null;
  RefreshToken?: string | null;
  ExpiresIn?: number | null;
}

export type CtxLike = {
  req?: { headers?: Record<string, unknown> };
  event?: { headers?: Record<string, string | undefined>; cookies?: string[] };
  responseCookies?: string[];
};

// ===========================================================
//               Cookie Serialization Helpers
// ===========================================================

// Build cookie options with environment-aware security settings
function baseCookieOpts(maxAge?: number) {
  return {
    httpOnly: true as const,
    secure: DEFAULT_SECURE,
    sameSite: DEFAULT_SAMESITE,
    path: '/' as const,
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  };
}
// serialize cookies using security options from baseCookieOpts
function serializeCookie(name: string, value: string, maxAge?: number) {
  return cookie.serialize(name, value, baseCookieOpts(maxAge));
}

// Create expired cookie for clearing
function serializeClear(name: string) {
  // Use Max-Age=0 and an epoch Expires to be extra-safe across browsers/CDNs.
  return cookie.serialize(name, '', {
    ...baseCookieOpts(0),
    expires: new Date(0),
  });
}

function buildAuthSetCookies(tokens: AuthTokens): string[] {
  const headers: string[] = [];
  const accessTtl = tokens.ExpiresIn ?? DEFAULT_TOKEN_TTL;
  const idTtl = tokens.ExpiresIn ?? DEFAULT_TOKEN_TTL;
  const refreshTtl = REFRESH_TOKEN_TTL;

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

// Build Set-Cookie headers that immediately expire all auth cookies
function buildAuthClearCookies(): string[] {
  return [serializeClear(COOKIE_ACCESS), serializeClear(COOKIE_ID), serializeClear(COOKIE_REFRESH)];
}

// ===========================================================
//              Public API - Set/Clear Cookies
// ===========================================================


/**
 * Generate the necessary `Set-Cookie` headers for authentication tokens
 * and append them to the existing `Set-Cookie` headers in the HTTP response, if provided.
 *
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

/**
 * Clear authentication cookies by setting them to expire immediately
 */
export function clearAuthCookies(res?: Response): string[] {
  const headers = buildAuthClearCookies();
  if (res) {
    const existing = res.getHeader('Set-Cookie');
    const arr = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
    res.setHeader('Set-Cookie', [...arr, ...headers]);
  }
  return headers;
}

// ===========================================================
//                       Cookie Parsing
// ===========================================================

export function parseCookieHeader(header: string | undefined | null): Record<string, string> {
  if (!header) return {};
  try {
    const parsed = cookie.parse(header);
    // Filter out undefined values
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

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

export function parseCookiesFromCtx(ctx?: CtxLike): Record<string, string> {
  const header = cookieHeaderFromCtx(ctx);
  return header ? parseCookieHeader(header) : {};
}

// Utility to push Set-Cookie strings to Lambda adapter context 
export function emitCookiesToLambda(ctx: CtxLike | undefined, headers: string[] | undefined) {
  if (!headers || headers.length === 0) return;
  ctx?.responseCookies?.push(...headers);
}
