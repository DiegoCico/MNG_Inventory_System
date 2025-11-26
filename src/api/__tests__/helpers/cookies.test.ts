import type { Response } from 'express';
import {
  setAuthCookies,
  clearAuthCookies,
  parseCookieHeader,
  parseCookiesFromCtx,
  cookieHeaderFromCtx,
  emitCookiesToLambda,
  COOKIE_ACCESS,
  COOKIE_ID,
  COOKIE_REFRESH,
  AuthTokens,
  CtxLike,
} from '../../src/helpers/cookies';

describe('cookies', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('setAuthCookies()', () => {
    it('generates Set-Cookie headers for all tokens', () => {
      const tokens: AuthTokens = {
        AccessToken: 'access-token-123',
        IdToken: 'id-token-456',
        RefreshToken: 'refresh-token-789',
        ExpiresIn: 3600,
      };

      const headers = setAuthCookies(undefined, tokens);

      expect(headers).toHaveLength(3);
      expect(headers[0]).toContain(`${COOKIE_ACCESS}=access-token-123`);
      expect(headers[1]).toContain(`${COOKIE_ID}=id-token-456`);
      expect(headers[2]).toContain(`${COOKIE_REFRESH}=refresh-token-789`);
    });

    it('sets httpOnly and path attributes', () => {
      const tokens: AuthTokens = {
        AccessToken: 'test-token',
        IdToken: null,
        RefreshToken: null,
      };

      const headers = setAuthCookies(undefined, tokens);

      expect(headers[0]).toContain('HttpOnly');
      expect(headers[0]).toContain('Path=/');
    });

    it('uses SameSite=Lax in non-production (default test environment)', () => {
      // cookies.ts reads NODE_ENV at module load time, so tests run in 'test' mode
      // which is treated as non-production, defaulting to SameSite=Lax
      const tokens: AuthTokens = {
        AccessToken: 'dev-token',
        IdToken: null,
      };

      const headers = setAuthCookies(undefined, tokens);

      expect(headers[0]).toContain('SameSite=Lax');
      expect(headers[0]).not.toContain('Secure');
    });

    it('sets Max-Age based on ExpiresIn', () => {
      const tokens: AuthTokens = {
        AccessToken: 'token',
        IdToken: null,
        ExpiresIn: 7200,
      };

      const headers = setAuthCookies(undefined, tokens);

      expect(headers[0]).toContain('Max-Age=7200');
    });

    it('skips null tokens', () => {
      const tokens: AuthTokens = {
        AccessToken: 'access-only',
        IdToken: null,
        RefreshToken: null,
      };

      const headers = setAuthCookies(undefined, tokens);

      expect(headers).toHaveLength(1);
      expect(headers[0]).toContain(COOKIE_ACCESS);
    });

    it('appends headers to Express response when provided', () => {
      const mockRes = {
        getHeader: jest.fn().mockReturnValue([]),
        setHeader: jest.fn(),
      } as unknown as Response;

      const tokens: AuthTokens = {
        AccessToken: 'token',
        IdToken: 'id',
      };

      setAuthCookies(mockRes, tokens);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.arrayContaining([
          expect.stringContaining(COOKIE_ACCESS),
          expect.stringContaining(COOKIE_ID),
        ]),
      );
    });

    it('preserves existing Set-Cookie headers', () => {
      const mockRes = {
        getHeader: jest.fn().mockReturnValue(['existing=cookie']),
        setHeader: jest.fn(),
      } as unknown as Response;

      const tokens: AuthTokens = {
        AccessToken: 'new-token',
        IdToken: null,
      };

      setAuthCookies(mockRes, tokens);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.arrayContaining(['existing=cookie', expect.stringContaining(COOKIE_ACCESS)]),
      );
    });
  });

  describe('clearAuthCookies()', () => {
    it('generates expired cookie headers for all auth cookies', () => {
      const headers = clearAuthCookies();

      expect(headers).toHaveLength(3);
      expect(headers[0]).toContain(`${COOKIE_ACCESS}=`);
      expect(headers[0]).toContain('Max-Age=0');
      expect(headers[1]).toContain(`${COOKIE_ID}=`);
      expect(headers[2]).toContain(`${COOKIE_REFRESH}=`);
    });

    it('sets Expires to epoch date', () => {
      const headers = clearAuthCookies();

      headers.forEach((header) => {
        expect(header).toContain('Expires=Thu, 01 Jan 1970');
      });
    });

    it('appends to Express response when provided', () => {
      const mockRes = {
        getHeader: jest.fn().mockReturnValue([]),
        setHeader: jest.fn(),
      } as unknown as Response;

      clearAuthCookies(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.any(Array));
      const calls = (mockRes.setHeader as jest.Mock).mock.calls[0][1];
      expect(calls).toHaveLength(3);
    });
  });

  describe('parseCookieHeader()', () => {
    it('parses valid cookie header string', () => {
      const header = 'session=abc123; user=john; theme=dark';
      const result = parseCookieHeader(header);

      expect(result).toEqual({
        session: 'abc123',
        user: 'john',
        theme: 'dark',
      });
    });

    it('returns empty object for null', () => {
      const result = parseCookieHeader(null);
      expect(result).toEqual({});
    });

    it('returns empty object for undefined', () => {
      const result = parseCookieHeader(undefined);
      expect(result).toEqual({});
    });

    it('returns empty object for empty string', () => {
      const result = parseCookieHeader('');
      expect(result).toEqual({});
    });

    it('handles single cookie', () => {
      const result = parseCookieHeader('single=value');
      expect(result).toEqual({ single: 'value' });
    });

    it('handles malformed cookie gracefully', () => {
      const result = parseCookieHeader('malformed');
      // cookie library may parse this differently, but shouldn't crash
      expect(result).toBeDefined();
    });
  });

  describe('cookieHeaderFromCtx()', () => {
    it('extracts cookie from event.cookies array', () => {
      const ctx: CtxLike = {
        event: {
          cookies: ['auth=token123', 'session=xyz'],
        },
      };

      const result = cookieHeaderFromCtx(ctx);

      expect(result).toContain('auth=token123');
      expect(result).toContain('session=xyz');
    });

    it('extracts cookie from event.headers.cookie (lowercase)', () => {
      const ctx: CtxLike = {
        event: {
          headers: {
            cookie: 'auth=token456',
          },
        },
      };

      const result = cookieHeaderFromCtx(ctx);

      expect(result).toBe('auth=token456');
    });

    it('extracts cookie from event.headers.Cookie (uppercase)', () => {
      const ctx: CtxLike = {
        event: {
          headers: {
            Cookie: 'auth=token789',
          },
        },
      };

      const result = cookieHeaderFromCtx(ctx);

      expect(result).toBe('auth=token789');
    });

    it('extracts cookie from req.headers.cookie', () => {
      const ctx: CtxLike = {
        req: {
          headers: {
            cookie: 'req=value',
          },
        },
      };

      const result = cookieHeaderFromCtx(ctx);

      expect(result).toBe('req=value');
    });

    it('combines cookies from array and header', () => {
      const ctx: CtxLike = {
        event: {
          cookies: ['cookie1=value1'],
          headers: {
            cookie: 'cookie2=value2',
          },
        },
      };

      const result = cookieHeaderFromCtx(ctx);

      expect(result).toContain('cookie1=value1');
      expect(result).toContain('cookie2=value2');
    });

    it('returns empty string when no cookies present', () => {
      const ctx: CtxLike = {};
      const result = cookieHeaderFromCtx(ctx);

      expect(result).toBe('');
    });

    it('handles undefined ctx', () => {
      const result = cookieHeaderFromCtx(undefined);
      expect(result).toBe('');
    });
  });

  describe('parseCookiesFromCtx()', () => {
    it('parses cookies from Lambda event context', () => {
      const ctx: CtxLike = {
        event: {
          headers: {
            cookie: 'auth_access=token123; auth_id=id456',
          },
        },
      };

      const result = parseCookiesFromCtx(ctx);

      expect(result).toEqual({
        auth_access: 'token123',
        auth_id: 'id456',
      });
    });

    it('parses cookies from Express request context', () => {
      const ctx: CtxLike = {
        req: {
          headers: {
            cookie: 'session=xyz',
          },
        },
      };

      const result = parseCookiesFromCtx(ctx);

      expect(result).toEqual({ session: 'xyz' });
    });

    it('returns empty object for undefined context', () => {
      const result = parseCookiesFromCtx(undefined);
      expect(result).toEqual({});
    });

    it('returns empty object when no cookies present', () => {
      const ctx: CtxLike = { event: {} };
      const result = parseCookiesFromCtx(ctx);

      expect(result).toEqual({});
    });
  });

  describe('emitCookiesToLambda()', () => {
    it('pushes headers to ctx.responseCookies', () => {
      const ctx: CtxLike = {
        responseCookies: [],
      };

      const headers = ['cookie1=value1', 'cookie2=value2'];
      emitCookiesToLambda(ctx, headers);

      expect(ctx.responseCookies).toEqual(headers);
    });

    it('does nothing when headers are empty', () => {
      const ctx: CtxLike = {
        responseCookies: [],
      };

      emitCookiesToLambda(ctx, []);

      expect(ctx.responseCookies).toEqual([]);
    });

    it('does nothing when headers are undefined', () => {
      const ctx: CtxLike = {
        responseCookies: [],
      };

      emitCookiesToLambda(ctx, undefined);

      expect(ctx.responseCookies).toEqual([]);
    });

    it('does nothing when ctx is undefined', () => {
      // Should not throw
      expect(() => emitCookiesToLambda(undefined, ['cookie=value'])).not.toThrow();
    });

    it('does nothing when responseCookies array is missing', () => {
      const ctx: CtxLike = {};

      // Should not throw
      expect(() => emitCookiesToLambda(ctx, ['cookie=value'])).not.toThrow();
    });
  });
});
