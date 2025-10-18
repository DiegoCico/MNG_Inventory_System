import type { Response } from "express";
import cookie from "cookie";

type TokenBundle = {
  AccessToken?: string | null;
  IdToken?: string | null;
  RefreshToken?: string | null;
  ExpiresIn?: number | null; 
};

export const setAuthCookies = (res: Response, tokens: TokenBundle) => {
  const isProd = process.env.NODE_ENV === "production";
  const headers: string[] = [];

  if (tokens.AccessToken) {
    headers.push(cookie.serialize("auth_access", tokens.AccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: tokens.ExpiresIn ?? 3600,
    }));
  }

  if (tokens.RefreshToken) {
    headers.push(cookie.serialize("auth_refresh", tokens.RefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    }));
  }

  if (tokens.IdToken) {
    headers.push(cookie.serialize("auth_id", tokens.IdToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: tokens.ExpiresIn ?? 3600,
    }));
  }

  res.setHeader("Set-Cookie", headers);
};

export const clearAuthCookies = (res: Response) => {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  res.setHeader("Set-Cookie", [
    cookie.serialize("auth_access", "", base),
    cookie.serialize("auth_refresh", "", base),
    cookie.serialize("auth_id", "", base),
  ]);
};
