import { decodeJwtNoVerify } from '../../src/helpers/authUtils';

describe('authUtils', () => {
  describe('decodeJwtNoVerify()', () => {
    it('decodes a valid JWT and returns payload', () => {
      // Standard JWT structure: header.payload.signature (base64url encoded)
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64url',
      );
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'user123',
          email: 'test@example.com',
          exp: 1234567890,
        }),
      ).toString('base64url');
      const signature = 'fake-signature';

      const token = `${header}.${payload}.${signature}`;
      const result = decodeJwtNoVerify(token);

      expect(result).toEqual({
        sub: 'user123',
        email: 'test@example.com',
        exp: 1234567890,
      });
    });

    it('returns null for null input', () => {
      const result = decodeJwtNoVerify(null);
      expect(result).toBeNull();
    });

    it('returns null for undefined input', () => {
      const result = decodeJwtNoVerify(undefined);
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = decodeJwtNoVerify('');
      expect(result).toBeNull();
    });

    it('returns null for malformed JWT with less than 3 parts', () => {
      const result = decodeJwtNoVerify('header.payload');
      expect(result).toBeNull();
    });

    it('returns null for malformed JWT with more than 3 parts', () => {
      const result = decodeJwtNoVerify('header.payload.signature.extra');
      expect(result).toBeNull();
    });

    it('returns null for invalid base64 encoding', () => {
      const result = decodeJwtNoVerify('invalid.!!!invalid!!!.signature');
      expect(result).toBeNull();
    });

    it('returns null for invalid JSON in payload', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const payload = Buffer.from('not-valid-json').toString('base64url');
      const signature = 'fake-signature';

      const token = `${header}.${payload}.${signature}`;
      const result = decodeJwtNoVerify(token);

      expect(result).toBeNull();
    });

    it('decodes JWT with minimal payload', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'user456' })).toString('base64url');
      const signature = 'sig';

      const token = `${header}.${payload}.${signature}`;
      const result = decodeJwtNoVerify(token);

      expect(result).toEqual({ sub: 'user456' });
    });

    it('preserves additional custom fields in payload', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'user789',
          email: 'custom@example.com',
          role: 'admin',
          teamId: 'team123',
          customField: 'value',
        }),
      ).toString('base64url');
      const signature = 'signature';

      const token = `${header}.${payload}.${signature}`;
      const result = decodeJwtNoVerify(token);

      expect(result).toEqual({
        sub: 'user789',
        email: 'custom@example.com',
        role: 'admin',
        teamId: 'team123',
        customField: 'value',
      });
    });

    it('handles payload without email field', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'user999',
          iat: 1234567890,
        }),
      ).toString('base64url');
      const signature = 'sig';

      const token = `${header}.${payload}.${signature}`;
      const result = decodeJwtNoVerify(token);

      expect(result).toEqual({
        sub: 'user999',
        iat: 1234567890,
      });
      expect(result?.email).toBeUndefined();
    });
  });
});
