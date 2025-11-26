import {
  QueryCommand,
  PutCommand,
  UpdateCommand,
  QueryCommandOutput,
  PutCommandOutput,
  UpdateCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { doc as dynamo } from '../../src/aws';
import { ensureUserRecord } from '../../src/helpers/awsUsers';

// Mock DynamoDB client
jest.mock('../../src/aws', () => ({
  doc: {
    send: jest.fn(),
  },
}));

// Mock loadConfig
jest.mock('../../src/process', () => ({
  loadConfig: jest.fn(() => ({
    TABLE_NAME: 'test-table',
  })),
}));

// Mock crypto.randomUUID
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'mocked-uuid-12345'),
}));

type DynamoDBCommand = QueryCommand | PutCommand | UpdateCommand;
type DynamoDBResponse = QueryCommandOutput | PutCommandOutput | UpdateCommandOutput;

const mockDynamoSend = dynamo.send as jest.MockedFunction<
  (command: DynamoDBCommand) => Promise<DynamoDBResponse>
>;

describe('awsUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureUserRecord()', () => {
    it('returns existing user with complete data', async () => {
      const existingUser = {
        PK: 'USER#user123',
        SK: 'METADATA',
        sub: 'user123',
        username: 'john_doe',
        name: 'John Doe',
        role: 'Admin',
        accountId: 'acc-123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock GSI lookup
      mockDynamoSend.mockResolvedValueOnce({
        Items: [existingUser],
        $metadata: {},
      });

      const result = await ensureUserRecord({ sub: 'user123' });

      expect(result).toEqual({
        userId: 'user123',
        username: 'john_doe',
        name: 'John Doe',
        role: 'Admin',
        accountId: 'acc-123',
      });

      // Should only query, not update
      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
      expect(mockDynamoSend).toHaveBeenCalledWith(expect.any(QueryCommand));
    });

    it('creates new user when not found', async () => {
      // Mock GSI lookup - no user found
      mockDynamoSend.mockResolvedValueOnce({ Items: [], $metadata: {} });

      // Mock username uniqueness check - available
      mockDynamoSend.mockResolvedValueOnce({ Items: [], $metadata: {} });

      // Mock PutCommand
      mockDynamoSend.mockResolvedValueOnce({ $metadata: {} });

      const result = await ensureUserRecord({ sub: 'new-user-456' });

      expect(result.userId).toBe('new-user-456');
      expect(result.username).toMatch(/^user-/);
      expect(result.name).toMatch(/^user-/);
      expect(result.role).toBe('User');
      expect(result.accountId).toBe('mocked-uuid-12345');

      // Should query GSI, check username, then put new user
      expect(mockDynamoSend).toHaveBeenCalledTimes(3);
      expect(mockDynamoSend).toHaveBeenNthCalledWith(3, expect.any(PutCommand));
    });

    it('fixes missing username on existing user', async () => {
      const userWithoutUsername = {
        PK: 'USER#user789',
        SK: 'METADATA',
        sub: 'user789',
        username: '', // Empty username
        name: 'Jane Doe',
        role: 'User',
        accountId: 'acc-789',
      };

      // Mock GSI lookup
      mockDynamoSend.mockResolvedValueOnce({ Items: [userWithoutUsername], $metadata: {} });

      // Mock username uniqueness check
      mockDynamoSend.mockResolvedValueOnce({ Items: [], $metadata: {} });

      // Mock UpdateCommand
      mockDynamoSend.mockResolvedValueOnce({ $metadata: {} });

      const result = await ensureUserRecord({ sub: 'user789' });

      expect(result.userId).toBe('user789');
      expect(result.username).toMatch(/^user-/);
      expect(result.accountId).toBe('acc-789');

      // Should update username
      expect(mockDynamoSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
    });

    it('fixes missing accountId on existing user', async () => {
      const userWithoutAccountId = {
        PK: 'USER#user999',
        SK: 'METADATA',
        sub: 'user999',
        username: 'test_user',
        name: 'Test User',
        role: 'User',
        // accountId is missing
      };

      // Mock GSI lookup
      mockDynamoSend.mockResolvedValueOnce({ Items: [userWithoutAccountId], $metadata: {} });

      // Mock UpdateCommand
      mockDynamoSend.mockResolvedValueOnce({ $metadata: {} });

      const result = await ensureUserRecord({ sub: 'user999' });

      expect(result.userId).toBe('user999');
      expect(result.username).toBe('test_user');
      expect(result.accountId).toBe('mocked-uuid-12345');

      // Should update accountId
      expect(mockDynamoSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
    });

    it('fixes both missing username and accountId', async () => {
      const userMissingBoth = {
        PK: 'USER#user111',
        SK: 'METADATA',
        sub: 'user111',
        username: null,
        name: 'Missing Data',
        role: 'User',
      };

      // Mock GSI lookup
      mockDynamoSend.mockResolvedValueOnce({ Items: [userMissingBoth], $metadata: {} });

      // Mock username uniqueness check
      mockDynamoSend.mockResolvedValueOnce({ Items: [], $metadata: {} });

      // Mock UpdateCommand for username
      mockDynamoSend.mockResolvedValueOnce({ $metadata: {} });

      // Mock UpdateCommand for accountId
      mockDynamoSend.mockResolvedValueOnce({ $metadata: {} });

      const result = await ensureUserRecord({ sub: 'user111' });

      expect(result.userId).toBe('user111');
      expect(result.username).toMatch(/^user-/);
      expect(result.accountId).toBe('mocked-uuid-12345');

      // Should call update twice (username and accountId)
      const updateCalls = mockDynamoSend.mock.calls.filter(
        (call) => call[0] instanceof UpdateCommand,
      );
      expect(updateCalls).toHaveLength(2);
    });

    it('handles username collision by appending counter', async () => {
      const existingUser = {
        PK: 'USER#user222',
        SK: 'METADATA',
        sub: 'user222',
        username: '',
        name: 'User',
        role: 'User',
        accountId: 'acc-222',
      };

      // Mock GSI lookup - found user
      mockDynamoSend.mockResolvedValueOnce({ Items: [existingUser], $metadata: {} });

      // Mock username check - first attempt taken
      mockDynamoSend.mockResolvedValueOnce({ Items: [{ username: 'user-abc123' }], $metadata: {} });

      // Mock username check - second attempt available
      mockDynamoSend.mockResolvedValueOnce({ Items: [], $metadata: {} });

      // Mock UpdateCommand
      mockDynamoSend.mockResolvedValueOnce({ $metadata: {} });

      const result = await ensureUserRecord({ sub: 'user222' });

      expect(result.username).toMatch(/^user-.*1$/); // Should have counter suffix
    });

    it('uses default role "User" when role is missing', async () => {
      const userWithoutRole = {
        PK: 'USER#user333',
        SK: 'METADATA',
        sub: 'user333',
        username: 'norole',
        name: 'No Role',
        accountId: 'acc-333',
      };

      mockDynamoSend.mockResolvedValueOnce({ Items: [userWithoutRole], $metadata: {} });

      const result = await ensureUserRecord({ sub: 'user333' });

      expect(result.role).toBe('User');
    });

    it('creates user with GSI attributes for lookup', async () => {
      // Mock GSI lookup - no user
      mockDynamoSend.mockResolvedValueOnce({ Items: [], $metadata: {} });

      // Mock username check
      mockDynamoSend.mockResolvedValueOnce({ Items: [], $metadata: {} });

      // Mock PutCommand
      mockDynamoSend.mockResolvedValueOnce({ $metadata: {} });

      await ensureUserRecord({ sub: 'newuser999' });

      const putCall = mockDynamoSend.mock.calls.find((call) => call[0] instanceof PutCommand);
      expect(putCall).toBeDefined();

      const putCommand = putCall![0] as PutCommand;
      const item = putCommand.input.Item;

      expect(item).toHaveProperty('GSI6PK', 'UID#newuser999');
      expect(item).toHaveProperty('GSI6SK', 'USER#newuser999');
    });

    it('sets timestamps on new user creation', async () => {
      // Mock GSI lookup - no user
      mockDynamoSend.mockResolvedValueOnce({ Items: [], $metadata: {} });

      // Mock username check
      mockDynamoSend.mockResolvedValueOnce({ Items: [], $metadata: {} });

      // Mock PutCommand
      mockDynamoSend.mockResolvedValueOnce({ $metadata: {} });

      await ensureUserRecord({ sub: 'timetest' });

      const putCall = mockDynamoSend.mock.calls.find((call) => call[0] instanceof PutCommand);
      const putCommand = putCall![0] as PutCommand;
      const item = putCommand.input.Item;

      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('updatedAt');

      // Verify timestamps are valid ISO strings
      const createdAt = new Date(item!.createdAt as string);
      const updatedAt = new Date(item!.updatedAt as string);
      expect(createdAt.toISOString()).toBe(item!.createdAt);
      expect(updatedAt.toISOString()).toBe(item!.updatedAt);
      expect(item!.createdAt).toBe(item!.updatedAt); // Should be same on creation
    });
  });
});
