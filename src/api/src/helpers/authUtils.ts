export type DecodedToken = {
  sub: string;
  email?: string;
  [k: string]: any;
};

/**
 * decodeJwtNoVerify
 * - parses a JWT (AccessToken or IdToken) without verifying signatures
 * - good enough for internal sessions behind your API Gateway
 */
export function decodeJwtNoVerify(token?: string | null): DecodedToken | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(json);
    return payload;
  } catch {
    return null;
  }
}
