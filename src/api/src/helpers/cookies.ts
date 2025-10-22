import type { Response } from "express";
import * as cookie from "cookie";

export interface AuthTokens {
  AccessToken: string | null;
  IdToken: string | null;
  RefreshToken?: string | null;
  ExpiresIn?: number | null; 
}

export const COOKIE_ACCESS = "auth_access";
export const COOKIE_ID = "auth_id";
export const COOKIE_REFRESH = "auth_refresh";


function baseCookieOpts(maxAge?: number) {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "none" as const,
    path: "/" as const,
    ...(typeof maxAge === "number" ? { maxAge } : {}),
  };
}

/** Serialize a cookie, omitting undefined values. */
function serializeCookie(name: string, value: string, maxAge?: number) {
  return cookie.serialize(name, value, baseCookieOpts(maxAge));
}

/** Serialize an immediate-expiry cookie to clear it. */
function serializeClear(name: string) {
  // Use Max-Age=0 and an epoch Expires to be extra-safe across browsers/CDNs.
  return cookie.serialize(name, "", {
    ...baseCookieOpts(0),
    expires: new Date(0),
  });
}

/**
 * Build Set-Cookie headers for a successful sign-in.
 * - Access/ID cookies live for ExpiresIn (default 3600s).
 * - Refresh cookie (if provided) lives for 30 days.
 */
export function buildAuthSetCookies(tokens: AuthTokens): string[] {
  const headers: string[] = [];
  const accessTtl = tokens.ExpiresIn ?? 3600; // seconds
  const idTtl = tokens.ExpiresIn ?? 3600; // seconds
  const refreshTtl = 60 * 60 * 24 * 30; // 30 days

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
export function setAuthCookies(
  res: Response | undefined,
  tokens: AuthTokens
): string[] {
  const headers = buildAuthSetCookies(tokens);
  if (res && headers.length) {
    // If multiple Set-Cookie headers already exist, append
    const existing = res.getHeader("Set-Cookie");
    const arr = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
    res.setHeader("Set-Cookie", [...arr, ...headers]);
  }
  return headers;
}

/** Convenience: clear cookies on an Express Response and return the headers. */
export function clearAuthCookies(res?: Response): string[] {
  const headers = buildAuthClearCookies();
  if (res) {
    const existing = res.getHeader("Set-Cookie");
    const arr = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
    res.setHeader("Set-Cookie", [...arr, ...headers]);
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
