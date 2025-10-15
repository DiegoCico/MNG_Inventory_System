process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_TEST123456';
process.env.COGNITO_CLIENT_ID = 'test-client-id-123456';

// Suppress console.log in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
};
