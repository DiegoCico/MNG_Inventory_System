import request from 'supertest';
import app from '../src/server';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock JWT verifier for protected routes
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

// Mock permissions check
jest.mock('../src/helpers/teamspaceHelpers', () => ({
  getUserPermissions: jest.fn(async () => ({
    roleName: 'OWNER',
    permissions: [
      'item.create',
      'item.view',
      'item.update',
      'item.delete',
      'item.reset',
    ],
  })),
  checkPermission: jest.fn(async () => ({ allowed: true })),
}));

// Mock S3 presigned URL generation
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://s3.example.com/presigned-url'),
}));

// Type for mockable commands
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

  // Default S3 mock - always succeeds
  s3SendSpy.mockResolvedValue({});
});

const validAuthCookie = 'auth_access=valid-token';

const mockItem = {
  PK: 'TEAM#team123',
  SK: 'ITEM#item456',
  teamId: 'team123',
  itemId: 'item456',
  name: 'Test Item',
  nsn: '1234-56-789-0123',
  status: 'To Review',
  authQuantity: 1,
  ohQuantity: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdBy: 'test-user-id',
  updateLog: [],
};

describe('Items Router', () => {
  describe('createItem', () => {
    it('creates item successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] }; // No duplicates
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } }; // User lookup
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          name: 'New Item',
          nsn: '1234-56-789-0123',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        itemId: expect.any(String),
      });
    });

    it('rejects duplicate NSN', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return {
            Items: [{ nsn: '1234-56-789-0123', itemId: 'existing-item' }],
          };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          name: 'Duplicate Item',
          nsn: '1234-56-789-0123',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toContain('already exists');
    });

    it('uploads image to S3 when provided', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          return {};
        }
        return {};
      });

      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const res = await request(app)
        .post('/trpc/createItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          name: 'Item With Image',
          nsn: '9999-99-999-9999',
          userId: 'test-user-id',
          imageBase64: base64Image,
        });

      expect(res.status).toBe(200);
      expect(s3SendSpy).toHaveBeenCalled();
    });

    it('creates kit item with kit-specific fields', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'PutCommand')) {
          const item = command.input.Item as Record<string, unknown>;
          expect(item.isKit).toBe(true);
          expect(item.liin).toBe('LIIN123');
          expect(item.endItemNiin).toBe('NIIN456');
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/createItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          name: 'Kit Item',
          nsn: '5555-55-555-5555',
          userId: 'test-user-id',
          isKit: true,
          liin: 'LIIN123',
          endItemNiin: 'NIIN456',
        });

      expect(res.status).toBe(200);
    });
  });

  describe('getItems', () => {
    it('returns all items for a team', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [mockItem] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: null }; // No parent
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getItems')
        .query({ input: JSON.stringify({ teamId: 'team123', userId: 'test-user-id' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        items: expect.any(Array),
      });
    });

    it('includes presigned URL for items with images', async () => {
      const itemWithImage = { ...mockItem, imageKey: 'items/team123/image.png' };

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [itemWithImage] };
        }
        return { Item: null };
      });

      const res = await request(app)
        .get('/trpc/getItems')
        .query({ input: JSON.stringify({ teamId: 'team123', userId: 'test-user-id' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      const items = res.body?.result?.data?.items;
      expect(items[0].imageLink).toBe('https://s3.example.com/presigned-url');
    });

    it('resolves parent name when item has parent', async () => {
      const childItem = { ...mockItem, parent: 'parent-item-id' };

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'QueryCommand')) {
          return { Items: [childItem] };
        }
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Parent Item Name' } };
        }
        return {};
      });

      const res = await request(app)
        .get('/trpc/getItems')
        .query({ input: JSON.stringify({ teamId: 'team123', userId: 'test-user-id' }) })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      const items = res.body?.result?.data?.items;
      expect(items[0].parentName).toBe('Parent Item Name');
    });
  });

  describe('getItem', () => {
    it('returns single item by id', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: mockItem });

      const res = await request(app)
        .get('/trpc/getItem')
        .query({
          input: JSON.stringify({
            teamId: 'team123',
            itemId: 'item456',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        item: expect.objectContaining({ itemId: 'item456' }),
      });
    });

    it('returns error when item not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .get('/trpc/getItem')
        .query({
          input: JSON.stringify({
            teamId: 'team123',
            itemId: 'nonexistent',
            userId: 'test-user-id',
          }),
        })
        .set('Cookie', validAuthCookie);

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'Item not found',
      });
    });
  });

  describe('updateItem', () => {
    it('updates item fields successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return {
            Attributes: {
              ...mockItem,
              name: 'Updated Name',
              status: 'Reviewed',
            },
          };
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/updateItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          itemId: 'item456',
          userId: 'test-user-id',
          name: 'Updated Name',
          status: 'Reviewed',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        item: expect.objectContaining({ name: 'Updated Name' }),
      });
    });

    it('uploads new image when imageBase64 provided', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          return { Attributes: mockItem };
        }
        return {};
      });

      const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

      const res = await request(app)
        .post('/trpc/updateItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          itemId: 'item456',
          userId: 'test-user-id',
          imageBase64: base64Image,
        });

      expect(res.status).toBe(200);
      expect(s3SendSpy).toHaveBeenCalled();
    });

    it('adds entry to updateLog', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: { name: 'Test User' } };
        }
        if (isCommandNamed(command, 'UpdateCommand')) {
          const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
          const log = values[':log'] as Array<Record<string, unknown>>;
          expect(log[0]).toMatchObject({
            userId: 'test-user-id',
            userName: 'Test User',
            action: 'update',
          });
          return { Attributes: mockItem };
        }
        return {};
      });

      await request(app)
        .post('/trpc/updateItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          itemId: 'item456',
          userId: 'test-user-id',
          status: 'Reviewed',
        });

      expect(dynamoSendSpy).toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('deletes item successfully', async () => {
      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: mockItem };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/deleteItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          itemId: 'item456',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        message: 'Item deleted successfully',
      });
    });

    it('deletes S3 image when item has imageKey', async () => {
      const itemWithImage = { ...mockItem, imageKey: 'items/team123/image.png' };

      dynamoSendSpy.mockImplementation(async (command: MockableCommand) => {
        if (isCommandNamed(command, 'GetCommand')) {
          return { Item: itemWithImage };
        }
        if (isCommandNamed(command, 'DeleteCommand')) {
          return {};
        }
        return {};
      });

      const res = await request(app)
        .post('/trpc/deleteItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          itemId: 'item456',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(200);
      expect(s3SendSpy).toHaveBeenCalled();
    });

    it('returns error when item not found', async () => {
      dynamoSendSpy.mockResolvedValue({ Item: null });

      const res = await request(app)
        .post('/trpc/deleteItem')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          itemId: 'nonexistent',
          userId: 'test-user-id',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: 'Item not found',
      });
    });
  });

  describe('uploadImage', () => {
    it('uploads image to S3 successfully', async () => {
      const base64Image = 'data:image/png;base64,iVBORw0KGgo=';

      const res = await request(app)
        .post('/trpc/uploadImage')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          nsn: '1234-56-789-0123',
          imageBase64: base64Image,
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: true,
        imageKey: expect.stringContaining('items/team123/'),
      });
      expect(s3SendSpy).toHaveBeenCalled();
    });

    it('handles S3 upload failure', async () => {
      s3SendSpy.mockRejectedValue(new Error('S3 upload failed'));

      const res = await request(app)
        .post('/trpc/uploadImage')
        .set('Cookie', validAuthCookie)
        .send({
          teamId: 'team123',
          nsn: '1234-56-789-0123',
          imageBase64: 'data:image/png;base64,abc123',
        });

      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('authentication', () => {
    it('rejects requests without auth cookie', async () => {
      const res = await request(app)
        .get('/trpc/getItems')
        .query({ input: JSON.stringify({ teamId: 'team123', userId: 'test-user-id' }) });

      expect(res.status).toBe(401);
    });
  });
});