import { UserStatusType, ChallengeNameType } from '@aws-sdk/client-cognito-identity-provider';

/**
 * This "fixtures" file contains mock return messages that Cognito returns
 * in a variety of events.
 *
 */

export const cognitoFixtures = {
  // What Cognito returns when we successfully invite a new user
  // Status 'FORCE_CHANGE_PASSWORD' means user must change password on first login
  inviteUserSuccess: {
    User: {
      Username: 'test@example.com',
      UserStatus: UserStatusType.FORCE_CHANGE_PASSWORD,
      Attributes: [
        { Name: 'email', Value: 'test@example.com' },
        { Name: 'email_verified', Value: 'true' },
      ],
    },
  },

  // What Cognito returns when a user signs in for the first time
  // ChallengeName indicates they need to set a new password
  signInChallenge: {
    ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
    ChallengeParameters: {
      USER_ID_FOR_SRP: 'test@example.com',
      requiredAttributes: '[]',
      userAttributes: '{"email":"test@example.com"}',
    },
    Session: 'mock-session-token-12345',
  },

  // What Cognito returns after successful authentication
  // Contains JWT tokens that prove the user is authenticated
  signInSuccess: {
    AuthenticationResult: {
      AccessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.mock-access-token',
      IdToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.mock-id-token',
      RefreshToken: 'mock-refresh-token-abcdef',
      TokenType: 'Bearer',
      ExpiresIn: 3600,
    },
  },
};
