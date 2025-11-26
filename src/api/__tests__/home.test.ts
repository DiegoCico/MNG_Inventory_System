import request from 'supertest';
import app from '../src/server';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
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
    permissions: ['item.delete', 'item.reset'],
  })),
}));

interface MockableCommand {
  constructor: { name: string };
  input: Record<string, unknown>;
}

function isCommandNamed(cmd: MockableCommand, name: string): boolean {
  return cmd.constructor.name === name;
}

let dynamoSendSpy: jest.SpyInstance;
let s3SendSpy: jest.SpyInstance;

beforeAll(() => {
  dynamoSendSpy = jest.spyOn(DynamoDBDocumentClient.prototype, 'send');
  s3SendSpy = jest.spyOn(S3Client.prototype, 'send');
});

afterAll(() => {
  dynamoSendSpy.mockRestore();
  s3SendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const validAuthCookie = 'auth_access=valid-token';

const mockItems = [
  { PK: 'TEAM#team123', SK: 'ITEM#item1', name: 'Item 1', imageKey: 'items/team123/img1.png' },
  { PK: 'TEAM#team123', SK: 'ITEM#item2', name: 'Item 2', imageKey: 'items/team123/img2.png' },
  { PK: 'TEAM#team123', SK: 'ITEM#item3', name: 'Item 3' }, // No image
];

describe('Home Router', () => {
  describe('hardReset', () => {
    it('deletes all items and S3 images for team', async () => {
      const deletedItems: string[] = [];

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: mockItems };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          const key = command.input.Key as { SK: string };
          deletedItems.push(key.SK);
          return {};
        }
        return {};
      });

      s3SendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'ListObjectsV2Command')) {
          return {
            Contents: [
              { Key: 'items/team123/img1.png' },
              { Key: 'items/team123/img2.png' },
            ],
          };
        }
        if (isCommandNamed(command, 'DeleteObjectsCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/hardReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: 'team123' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        message: 'Hard reset completed.',
      });

      // Verify all items deleted
      expect(deletedItems).toHaveLength(3);
      expect(deletedItems).toContain('ITEM#item1');
      expect(deletedItems).toContain('ITEM#item2');
      expect(deletedItems).toContain('ITEM#item3');

      // Verify S3 cleanup called
      expect(s3SendSpy).toHaveBeenCalledTimes(2); // List + Delete
    });

    it('handles empty team (no items)', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [] });
      s3SendSpy.mockResolvedValue({ Contents: [] });

      const res = await request(app)
        .post('/trpc/hardReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: 'empty-team' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
    });

    it('skips S3 delete when no objects exist', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: mockItems });

      s3SendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'ListObjectsV2Command')) {
          return { Contents: [] }; // No S3 objects
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/hardReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: 'team123' });

      expect(res.status).toBe(200);
      // DeleteObjectsCommand should not be called
      expect(s3SendSpy).toHaveBeenCalledTimes(1); // Only ListObjectsV2
    });

    it('handles DynamoDB error gracefully', async () => {
      dynamoSendSpy.mockRejectedValue(new Error('DynamoDB unavailable'));

      const res = await request(app)
        .post('/trpc/hardReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: 'team123' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'DynamoDB unavailable',
      });
    });

    it('handles S3 error gracefully', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [] });
      s3SendSpy.mockRejectedValue(new Error('S3 unavailable'));

      const res = await request(app)
        .post('/trpc/hardReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: 'team123' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'S3 unavailable',
      });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/hardReset')
        .send({ teamId: 'team123' });

      expect(res.status).toBe(401);
    });

    it('validates teamId is not empty', async () => {
      const res = await request(app)
        .post('/trpc/hardReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('softReset', () => {
    it('resets all items status to "To Review"', async () => {
      const updatedItems: string[] = [];

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: mockItems };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const key = command.input.Key as { SK: string };
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;

          expect(values[':s']).toBe('To Review');
          expect(values[':u']).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp

          updatedItems.push(key.SK);
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/softReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: 'team123' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        message: 'Soft reset completed.',
      });

      // Verify all items updated
      expect(updatedItems).toHaveLength(3);
    });

    it('handles empty team (no items)', async () => {
      dynamoSendSpy.mockResolvedValue({ Items: [] });

      const res = await request(app)
        .post('/trpc/softReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: 'empty-team' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data?.success).toBe(true);
    });

    it('handles DynamoDB error gracefully', async () => {
      dynamoSendSpy.mockRejectedValue(new Error('DynamoDB unavailable'));

      const res = await request(app)
        .post('/trpc/softReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: 'team123' });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'DynamoDB unavailable',
      });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/trpc/softReset')
        .send({ teamId: 'team123' });

      expect(res.status).toBe(401);
    });

    it('validates teamId is not empty', async () => {
      const res = await request(app)
        .post('/trpc/softReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: '' });

      expect(res.status).toBe(400);
    });

    it('does not touch S3 (preserves images)', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: mockItems };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {};
        }
        return {};
      });

      await request(app)
        .post('/trpc/softReset')
        .set('Cookie', validAuthCookie)
        .send({ teamId: 'team123' });

      // S3 should never be called for soft reset
      expect(s3SendSpy).not.toHaveBeenCalled();
    });
  });
});