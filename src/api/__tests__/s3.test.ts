import request from 'supertest';
import app from '../src/server';
import { S3Client } from '@aws-sdk/client-s3';

// Mock JWT verifier
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(async () => ({
        sub: 'test-user-id',
        'cognito:username': 'testuser',
        email: 'test@example.com',
      })),
    })),
  },
}));

// Mock permissions
jest.mock('../src/helpers/teamspaceHelpers', () => ({
  getUserPermissions: jest.fn(async () => ({
    roleName: 'OWNER',
    permissions: ['reports.create'],
  })),
}));

// Mock presigned URL generation
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://s3.example.com/presigned-url'),
}));

interface MockableCommand {
  constructor: { name: string };
  input: Record<string, unknown>;
}

function isCommandNamed(cmd: MockableCommand, name: string): boolean {
  return cmd.constructor.name === name;
}

let s3SendSpy: jest.SpyInstance;

beforeAll(() => {
  s3SendSpy = jest.spyOn(S3Client.prototype, 'send');
});

afterAll(() => {
  s3SendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  s3SendSpy.mockResolvedValue({});
});

const validAuthCookie = 'auth_access=valid-token';

// Valid base64 PNG (1x1 pixel)
const validPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const validJpegDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//';

describe('S3 Router', () => {
  describe('uploadProfileImage', () => {
    it('uploads image and returns presigned URL', async () => {
      const res = await request(app)
        .post('/trpc/uploadProfileImage')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'user123',
          dataUrl: validPngDataUrl,
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        key: 'Profile/user123.png',
        url: 'https://s3.example.com/presigned-url',
      });
      expect(s3SendSpy).toHaveBeenCalled();
    });

    it('handles jpeg images correctly', async () => {
      const res = await request(app)
        .post('/trpc/uploadProfileImage')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'user123',
          dataUrl: validJpegDataUrl,
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.key).toBe('Profile/user123.jpeg');
    });

    it('validates userId minimum length', async () => {
      const res = await request(app)
        .post('/trpc/uploadProfileImage')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'ab', // Too short
          dataUrl: validPngDataUrl,
        });

      expect(res.status).toBe(400);
    });

    it('validates dataUrl starts with data:', async () => {
      const res = await request(app)
        .post('/trpc/uploadProfileImage')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'user123',
          dataUrl: 'https://example.com/image.png',
        });

      expect(res.status).toBe(400);
    });

    it('rejects invalid data URL format', async () => {
      const res = await request(app)
        .post('/trpc/uploadProfileImage')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'user123',
          dataUrl: 'data:invalid-format',
        });

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).toContain('Invalid data URL format');
    });

    it('handles S3 upload failure', async () => {
      s3SendSpy.mockRejectedValue(new Error('S3 upload failed'));

      const res = await request(app)
        .post('/trpc/uploadProfileImage')
        .set('Cookie', validAuthCookie)
        .send({
          userId: 'user123',
          dataUrl: validPngDataUrl,
        });

      expect(res.status).toBe(500);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/uploadProfileImage')
        .send({
          userId: 'user123',
          dataUrl: validPngDataUrl,
        });

      expect(res.status).toBe(401);
    });
  });

  describe('getProfileImage', () => {
    it('returns presigned URL when image exists', async () => {
      s3SendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'HeadObjectCommand')) {
          return {}; // Object exists
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getProfileImage')
        .query({ input: JSON.stringify({ userId: 'user123' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        url: 'https://s3.example.com/presigned-url',
      });
    });

    it('returns null when no image found', async () => {
      s3SendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'HeadObjectCommand')) {
          throw new Error('NotFound');
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getProfileImage')
        .query({ input: JSON.stringify({ userId: 'user123' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        url: null,
      });
    });

    it('tries multiple extensions until found', async () => {
      let headCallCount = 0;

      s3SendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'HeadObjectCommand')) {
          headCallCount++;
          const key = command.input.Key as string;
          // Only png exists (third attempt)
          if (key.endsWith('.png')) {
            return {};
          }
          throw new Error('NotFound');
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getProfileImage')
        .query({ input: JSON.stringify({ userId: 'user123' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.url).toBe('https://s3.example.com/presigned-url');
      expect(headCallCount).toBe(3); // jpg, jpeg, then png found
    });

    it('validates userId minimum length', async () => {
      const res = await request(app)
        .get('/trpc/getProfileImage')
        .query({ input: JSON.stringify({ userId: 'ab' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/trpc/getProfileImage')
        .query({ input: JSON.stringify({ userId: 'user123' }) });

      expect(res.status).toBe(401);
    });
  });

  describe('getInventoryForm', () => {
    it('returns presigned URL when form exists', async () => {
      s3SendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'HeadObjectCommand')) {
          return {}; // Object exists
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getInventoryForm')
        .query({
          input: JSON.stringify({
            teamId: 'team123',
            nsn: '1234-56-789-0123',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        url: 'https://s3.example.com/presigned-url',
        key: 'Documents/team123/inventoryForm/1234-56-789-0123.pdf',
      });
    });

    it('uses default teamId when not provided', async () => {
      s3SendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'HeadObjectCommand')) {
          const key = command.input.Key as string;
          expect(key).toContain('defaultTeam');
          return {};
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getInventoryForm')
        .query({
          input: JSON.stringify({ nsn: '1234-56-789-0123' }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.key).toContain('defaultTeam');
    });

    it('returns error when form not found', async () => {
      s3SendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'HeadObjectCommand')) {
          throw new Error('NotFound');
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getInventoryForm')
        .query({
          input: JSON.stringify({
            teamId: 'team123',
            nsn: 'nonexistent',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).toContain('not found');
    });

    it('validates NSN is required', async () => {
      const res = await request(app)
        .get('/trpc/getInventoryForm')
        .query({
          input: JSON.stringify({ teamId: 'team123', nsn: '' }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/trpc/getInventoryForm')
        .query({
          input: JSON.stringify({ nsn: '1234-56-789-0123' }),
        });

      expect(res.status).toBe(401);
    });
  });
});