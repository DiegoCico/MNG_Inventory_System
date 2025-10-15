// import { mockClient } from 'aws-sdk-client-mock';
// import {
//   CognitoIdentityProviderClient,
//   AdminCreateUserCommand,
//   AdminInitiateAuthCommand,
//   AdminRespondToAuthChallengeCommand,
// } from '@aws-sdk/client-cognito-identity-provider';
// import request from 'supertest';
// import app from '../src/server';
// import { cognitoFixtures } from './fixtures/cognito.fixtures';

// const cognitoMock = mockClient(CognitoIdentityProviderClient);

// describe('Auth Router', () => {
//   beforeEach(() => {
//     cognitoMock.reset();
//   });

//   describe('inviteUser', () => {
//     it('should invite user successfully', async () => {
//       cognitoMock.on(AdminCreateUserCommand).resolves({
//         User: {
//           Username: 'test@example.com',
//           UserStatus: 'FORCE_CHANGE_PASSWORD',
//         },
//       });

//       const response = await request(app)
//         .post('/trpc/auth.inviteUser')
//         .send({ input: { email: 'test@example.com' } })
//         .expect(200);

//       expect(response.body.result.data).toMatchObject({
//         success: true,
//         userId: 'test@example.com',
//         userStatus: 'FORCE_CHANGE_PASSWORD',
//         message: expect.stringContaining('invited successfully'),
//       });
//     });

//     it('should handle user already exists error', async () => {
//       const error = new Error('User already exists');
//       error.name = 'UsernameExistsException';
//       cognitoMock.on(AdminCreateUserCommand).rejects(error);

//       const response = await request(app)
//         .post('/trpc/auth.inviteUser')
//         .send({ input: { email: 'existing@example.com' } });

//       expect(response.body.error).toBeDefined();
//       expect(response.body.error.message).toContain('User already exists');
//     });
//   });

//   describe('signIn', () => {
//     it('should return challenge for first-time login', async () => {
//       cognitoMock.on(AdminInitiateAuthCommand).resolves({
//         ChallengeName: 'NEW_PASSWORD_REQUIRED',
//         ChallengeParameters: { USER_ID_FOR_SRP: 'test@example.com' },
//         Session: 'mock-session-token',
//       });

//       const response = await request(app)
//         .post('/trpc/auth.signIn')
//         .send({
//           input: {
//             email: 'test@example.com',
//             password: 'TempPassword123!',
//           },
//         })
//         .expect(200);

//       expect(response.body.result.data).toMatchObject({
//         success: false,
//         challengeName: 'NEW_PASSWORD_REQUIRED',
//         session: 'mock-session-token',
//       });
//     });

//     it('should return tokens for successful authentication', async () => {
//       cognitoMock.on(AdminInitiateAuthCommand).resolves({
//         AuthenticationResult: {
//           AccessToken: 'mock-access-token',
//           IdToken: 'mock-id-token',
//           RefreshToken: 'mock-refresh-token',
//           TokenType: 'Bearer',
//           ExpiresIn: 3600,
//         },
//       });

//       const response = await request(app)
//         .post('/trpc/auth.signIn')
//         .send({
//           input: {
//             email: 'test@example.com',
//             password: 'ValidPassword123!',
//           },
//         })
//         .expect(200);

//       expect(response.body.result.data).toMatchObject({
//         success: true,
//         accessToken: 'mock-access-token',
//         idToken: 'mock-id-token',
//         refreshToken: 'mock-refresh-token',
//       });
//     });
//   });

//   describe('respondToChallenge', () => {
//     it('should complete password challenge successfully', async () => {
//       cognitoMock.on(AdminRespondToAuthChallengeCommand).resolves({
//         AuthenticationResult: {
//           AccessToken: 'mock-access-token',
//           IdToken: 'mock-id-token',
//           RefreshToken: 'mock-refresh-token',
//           TokenType: 'Bearer',
//           ExpiresIn: 3600,
//         },
//       });

//       const response = await request(app)
//         .post('/trpc/auth.respondToChallenge')
//         .send({
//           input: {
//             challengeName: 'NEW_PASSWORD_REQUIRED',
//             session: 'mock-session',
//             newPassword: 'NewPassword123!',
//             email: 'test@example.com',
//           },
//         })
//         .expect(200);

//       expect(response.body.result.data).toMatchObject({
//         success: true,
//         accessToken: 'mock-access-token',
//         message: 'Password updated and sign in successful',
//       });
//     });
//   });
// });

// describe('Auth Integration Tests', () => {
//   beforeEach(() => {
//     cognitoMock.reset();
//   });

//   it('should handle complete user invitation flow', async () => {
//     cognitoMock.onAnyCommand().resolves(cognitoFixtures.inviteUserSuccess);

//     // Test the actual tRPC endpoint structure
//     const response = await request(app)
//       .post('/trpc/auth.inviteUser')
//       .send({ input: { email: 'newuser@example.com' } })
//       .set('Content-Type', 'application/json');

//     expect(response.status).toBe(200);
//     expect(response.body).toHaveProperty('result');
//     expect(response.body.result.data.success).toBe(true);
//   });

//   it('should handle user authentication flow with challenge', async () => {
//     // Mock the sign-in response
//     cognitoMock.onAnyCommand().resolves(cognitoFixtures.signInChallenge);

//     const signInResponse = await request(app)
//       .post('/trpc/auth.signIn')
//       .send({
//         input: {
//           email: 'test@example.com',
//           password: 'TempPassword123!',
//         },
//       });

//     expect(signInResponse.body.result.data.challengeName).toBe('NEW_PASSWORD_REQUIRED');

//     // Mock the challenge response
//     cognitoMock.reset();
//     cognitoMock.onAnyCommand().resolves(cognitoFixtures.signInSuccess);

//     const challengeResponse = await request(app)
//       .post('/trpc/auth.respondToChallenge')
//       .send({
//         input: {
//           challengeName: 'NEW_PASSWORD_REQUIRED',
//           session: signInResponse.body.result.data.session,
//           newPassword: 'NewSecurePassword123!',
//           email: 'test@example.com',
//         },
//       });

//     expect(challengeResponse.body.result.data.success).toBe(true);
//     expect(challengeResponse.body.result.data.accessToken).toBeDefined();
//   });
// });
