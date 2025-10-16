/**
 * INTEGRATION TESTS - Auth Router
 *
 * These tests verify the entire tRPC authentication flow using REAL AWS Cognito calls.
 * They simulate exactly what a frontend client would experience in production.
 *
 * WARNING: These tests cost money to run!
 * Only run with: RUN_INTEGRATION_TESTS=true npm test
 */

import request from 'supertest';
import app from '../../src/server';
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const testUserPoolId = process.env.TEST_COGNITO_USER_POOL_ID;
const runIntegrationTests = testUserPoolId && process.env.RUN_INTEGRATION_TESTS === 'true';

(runIntegrationTests ? describe : describe.skip)(
  'Auth Router - Integration Tests (Real AWS)',
  () => {
    const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });
    const createdUsers: string[] = []; // Track users for cleanup

    afterEach(async () => {
      // Cleanup: Delete any users created during tests
      for (const email of createdUsers) {
        try {
          await client.send(
            new AdminDeleteUserCommand({
              UserPoolId: testUserPoolId,
              Username: email,
            }),
          );
        } catch (error) {
          // User might not exist, that's ok
          console.log(`Could not delete test user ${email}:`, error);
        }
      }
      createdUsers.length = 0; // Clear the array
    });

    describe('Real AWS Integration', () => {
      it('should invite user through complete tRPC flow with real AWS', async () => {
        const testEmail = `test-${Date.now()}@example.com`;
        createdUsers.push(testEmail); // Track for cleanup

        // Test the full tRPC endpoint (Router → AWS Cognito)
        const response = await request(app)
          .post('/trpc/auth.inviteUser')
          .send({ email: testEmail })
          .set('Content-Type', 'application/json');

        // Verify HTTP response
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('result');

        // Verify the router's response format matches real AWS
        const result = response.body.result.data;
        expect(result).toMatchObject({
          success: true,
          userId: testEmail,
          userStatus: 'FORCE_CHANGE_PASSWORD', // Real AWS response
          message: expect.stringContaining('invited successfully'),
        });
      }, 15000); // Longer timeout for real AWS calls

      it('should handle complete authentication flow with real AWS', async () => {
        const testEmail = `test-${Date.now()}@example.com`;
        createdUsers.push(testEmail);

        // Step 1: Invite the user through the router
        const inviteResponse = await request(app)
          .post('/trpc/auth.inviteUser')
          .send({ email: testEmail })
          .expect(200);

        expect(inviteResponse.body.result.data.success).toBe(true);

        // Step 2: Try to sign in (should get challenge for temp password)
        // Note: We can't know the temp password, so this will demonstrate the challenge flow
        const signInResponse = await request(app)
          .post('/trpc/auth.signIn')
          .send({
            email: testEmail,
            password: 'WrongTempPassword123!', // Intentionally wrong
          })
          .set('Content-Type', 'application/json');

        // Should fail with authentication error (expected)
        expect(signInResponse.status).toBe(500);
        expect(signInResponse.body.error.message).toContain('Invalid email or password');
      }, 20000);

      it('should handle validation errors before reaching AWS', async () => {
        // Test invalid email through router - should fail validation before AWS call
        const response = await request(app)
          .post('/trpc/auth.inviteUser')
          .send({ email: 'not-an-email' })
          .set('Content-Type', 'application/json');

        // Router should catch validation error before calling AWS
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error.message).toContain('Invalid email');
      });

      it('should handle duplicate user creation with real AWS error', async () => {
        const testEmail = `test-${Date.now()}@example.com`;
        createdUsers.push(testEmail);

        // Create user first time
        await request(app).post('/trpc/auth.inviteUser').send({ email: testEmail }).expect(200);

        // Try to create same user again - should get real AWS error
        const duplicateResponse = await request(app)
          .post('/trpc/auth.inviteUser')
          .send({ email: testEmail })
          .set('Content-Type', 'application/json');

        expect(duplicateResponse.status).toBe(500);
        expect(duplicateResponse.body.error.message).toContain('User already exists');
      }, 15000);
    });
  },
);
