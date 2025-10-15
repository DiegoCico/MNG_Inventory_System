import { mockClient } from 'aws-sdk-client-mock';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import request from 'supertest';
import app from '../../src/server';
import { cognitoFixtures } from '../fixtures/cognito.fixtures';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

describe('Auth Router - Unit Tests (Mocked AWS)', () => {
  beforeEach(() => {
    cognitoMock.reset();
  });

  describe('inviteUser', () => {
    it('should invite user successfully', async () => {
      cognitoMock.on(AdminCreateUserCommand).resolves(cognitoFixtures.inviteUserSuccess);

      const response = await request(app)
        .post('/trpc/auth.inviteUser')
        .send({ email: 'test@example.com' })
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.result.data).toMatchObject({
        success: true,
        userId: 'test@example.com',
        userStatus: 'FORCE_CHANGE_PASSWORD',
        message: expect.stringContaining('invited successfully'),
      });

      // Verify AWS command was called correctly
      expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(1);
    });

    it('should handle user already exists error', async () => {
      const error = new Error('User already exists');
      error.name = 'UsernameExistsException';
      cognitoMock.on(AdminCreateUserCommand).rejects(error);

      const response = await request(app)
        .post('/trpc/auth.inviteUser')
        .send({ email: 'existing@example.com' })
        .set('Content-Type', 'application/json')
        .expect(500);

      expect(response.body.error.message).toContain('User already exists');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/trpc/auth.inviteUser')
        .send({ email: 'not-an-email' })
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
    });
  });

  describe('signIn', () => {
    it('should return challenge for first-time login', async () => {
      cognitoMock.on(AdminInitiateAuthCommand).resolves(cognitoFixtures.signInChallenge);

      const response = await request(app)
        .post('/trpc/auth.signIn')
        .send({
          email: 'test@example.com',
          password: 'TempPassword123!',
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.result.data).toMatchObject({
        success: false,
        challengeName: 'NEW_PASSWORD_REQUIRED',
        session: 'mock-session-token-12345',
        message: 'Additional authentication step required',
      });
    });

    it('should return tokens for successful authentication', async () => {
      cognitoMock.on(AdminInitiateAuthCommand).resolves(cognitoFixtures.signInSuccess);

      const response = await request(app)
        .post('/trpc/auth.signIn')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!',
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.result.data).toMatchObject({
        success: true,
        accessToken: expect.stringContaining('mock-access-token'),
        idToken: expect.stringContaining('mock-id-token'),
        refreshToken: 'mock-refresh-token-abcdef',
        tokenType: 'Bearer',
        expiresIn: 3600,
        message: 'Sign in successful',
      });
    });
  });

  describe('respondToChallenge', () => {
    it('should complete password challenge successfully', async () => {
      cognitoMock.on(AdminRespondToAuthChallengeCommand).resolves(cognitoFixtures.signInSuccess);

      const response = await request(app)
        .post('/trpc/auth.respondToChallenge')
        .send({
          challengeName: 'NEW_PASSWORD_REQUIRED',
          session: 'mock-session',
          newPassword: 'NewPassword123!',
          email: 'test@example.com',
        })
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.result.data).toMatchObject({
        success: true,
        accessToken: expect.stringContaining('mock-access-token'),
        message: 'Password updated and sign in successful',
      });
    });
  });
});
