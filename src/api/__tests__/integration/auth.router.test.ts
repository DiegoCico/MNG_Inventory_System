// /**
//  * ROUTER INTEGRATION TESTS
//  * 
//  * These tests verify that the complete tRPC authentication flow works end-to-end.
//  * Unlike unit tests (which mock AWS) or service tests (which test services directly),
//  * these tests simulate exactly what a frontend client would do.
//  * 
 
//  * - Set TEST_COGNITO_USER_POOL_ID environment variable
//  * - Set RUN_INTEGRATION_TESTS=true environment variable
//  * - Have AWS credentials configured for test environment
//  * - Use a SEPARATE test Cognito User Pool (never test against production!)
//  */

// import request from 'supertest';
// import app from '../../src/server';
// import {
//   CognitoIdentityProviderClient,
//   AdminDeleteUserCommand,
// } from '@aws-sdk/client-cognito-identity-provider';


// // Integrations tests cost money, so only run if
// const testUserPoolId = process.env.TEST_COGNITO_USER_POOL_ID;
// const runIntegrationTests = testUserPoolId && process.env.RUN_INTEGRATION_TESTS === 'true';

// (runIntegrationTests ? describe : describe.skip)(
//   'Auth Router Integration Tests (Real Cognito)',
//   () => {
//     const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });
//     const createdUsers: string[] = []; // Track users for cleanup

//     afterEach(async () => {
//       // Cleanup: Delete any users created during tests
//       for (const email of createdUsers) {
//         try {
//           await client.send(
//             new AdminDeleteUserCommand({
//               UserPoolId: testUserPoolId,
//               Username: email,
//             }),
//           );
//         } catch (error) {
//           // User might not exist, that's ok
//           console.log(`Could not delete test user ${email}:`, error);
//         }
//       }
//       createdUsers.length = 0; // Clear the array
//     });

//     it('should invite user through tRPC router endpoint', async () => {
//       const testEmail = `test-${Date.now()}@example.com`;
//       createdUsers.push(testEmail); // Track for cleanup

//       // Test the full tRPC endpoint (Router → Service → AWS Cognito)
//       const response = await request(app)
//         .post('/trpc/auth.inviteUser')
//         .send({ input: { email: testEmail } })
//         .set('Content-Type', 'application/json');

//       // Verify HTTP response
//       expect(response.status).toBe(200);
//       expect(response.body).toHaveProperty('result');

//       // Verify the router's response format
//       const result = response.body.result.data;
//       expect(result).toMatchObject({
//         success: true,
//         userId: testEmail,
//         userStatus: 'FORCE_CHANGE_PASSWORD',
//         message: expect.stringContaining('invited successfully'),
//       });
//     }, 15000); // Longer timeout for real AWS calls

//     it('should handle sign in through tRPC router endpoint', async () => {
//       const testEmail = `test-${Date.now()}@example.com`;
//       createdUsers.push(testEmail);

//       // First, invite the user through the router
//       await request(app)
//         .post('/trpc/auth.inviteUser')
//         .send({ input: { email: testEmail } })
//         .expect(200);

//       // Then try to sign in (should get challenge for temp password)
//       const signInResponse = await request(app)
//         .post('/trpc/auth.signIn')
//         .send({
//           input: {
//             email: testEmail,
//             password: 'TempPassword123!', // Default temp password format
//           },
//         })
//         .set('Content-Type', 'application/json');

//       expect(signInResponse.status).toBe(200);

//       const result = signInResponse.body.result.data;
//       // Should get challenge since it's first login with temp password
//       expect(result.success).toBe(false);
//       expect(result.challengeName).toBe('NEW_PASSWORD_REQUIRED');
//       expect(result.session).toBeTruthy();
//     }, 20000);

//     it('should handle router validation errors', async () => {
//       // Test invalid email through router
//       const response = await request(app)
//         .post('/trpc/auth.inviteUser')
//         .send({ input: { email: 'not-an-email' } })
//         .set('Content-Type', 'application/json');

//       // Router should catch validation error before calling service
//       expect(response.status).toBe(400);
//       expect(response.body).toHaveProperty('error');
//       expect(response.body.error.message).toContain('Invalid email');
//     });
//   },
// );
