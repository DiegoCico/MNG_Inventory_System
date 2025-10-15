import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  MessageActionType,
  AuthFlowType,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';




// Environment configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.COGNITO_CLIENT_ID;

if (!USER_POOL_ID || !USER_POOL_CLIENT_ID) {
  throw new Error('COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID environment variables are required');
}

export class CognitoService {
  private client: CognitoIdentityProviderClient;

  constructor() {
    this.client = new CognitoIdentityProviderClient({ region: AWS_REGION });
  }

  /**
   * Create a new user in Cognito User Pool and send them an invite email
   */
  async inviteUser(params: { email: string }) {
    const command = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: params.email,
      UserAttributes: [
        { Name: 'email', Value: params.email },
        { Name: 'email_verified', Value: 'true' },
      ],
      MessageAction: MessageActionType.RESEND, // Send Cognito's invitation email
      DesiredDeliveryMediums: ['EMAIL'],
    });

    return await this.client.send(command);
  }

  /**
   * Authenticate a user
   */
  async signIn(params: { email: string; password: string }) {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: USER_POOL_CLIENT_ID,
      AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: params.email,
        PASSWORD: params.password,
      },
    });
    return await this.client.send(command);
  }

  /**
   * Respond to authentication challenges
   */
  async respondToChallenge(params: {
    challengeName: string;
    session: string;
    newPassword: string;
    email: string;
  }) {
    const command = new AdminRespondToAuthChallengeCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: USER_POOL_CLIENT_ID,
      ChallengeName: params.challengeName as ChallengeNameType,
      Session: params.session,
      ChallengeResponses: {
        USERNAME: params.email,
        NEW_PASSWORD: params.newPassword,
      },
    });

    return await this.client.send(command);
  }
}
