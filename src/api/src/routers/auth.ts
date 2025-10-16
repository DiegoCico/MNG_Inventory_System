import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  MessageActionType,
  AuthFlowType,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  SESv2Client,
  SendEmailCommand,
  SendEmailCommandInput,
} from '@aws-sdk/client-sesv2';
import crypto from 'crypto';
import { cognitoClient, sesClient, AWS_CONFIG } from "../aws";


const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_sP3HAecAw';
const USER_POOL_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '6vk8qbvjv6hvb99a0jjcpbth9k';
const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS || 'cicotoste.d@northeastern.edu';
const APP_SIGNIN_URL = process.env.APP_SIGNIN_URL || 'https://d2cktegyq4qcfk.cloudfront.net/signin';

// const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });
// const sesClient = new SESv2Client({ region: AWS_REGION });

/**
 * Helper: Generate a random temporary password that satisfies Cognito's password policy
 */
const generateTempPassword = (): string => {
  const base = crypto.randomBytes(6).toString('base64');
  const extras = 'Aa1!';
  return (base + extras).slice(0, 16);
};

/**
 * Helper: Send invitation email using Amazon SES
 */
const sendInviteEmail = async (params: { to: string; tempPassword: string; signinUrl: string }) => {
  const { to, tempPassword, signinUrl } = params;

  const subject = 'Your MNG Inventory invitation';
  const text = `Hi,

You’ve been invited to MNG Inventory.

Email: ${to}
Temporary password: ${tempPassword}

Please sign in here: ${signinUrl}

You’ll be prompted to set a new password on first login.`;

  const html = `
  <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
    <h2>Welcome to MNG Inventory</h2>
    <p>You’ve been invited to join the platform. Use the credentials below to sign in for the first time:</p>
    <ul>
      <li><b>Email:</b> ${to}</li>
      <li><b>Temporary password:</b> <code>${tempPassword}</code></li>
    </ul>
    <p><a href="${signinUrl}" target="_blank" rel="noopener noreferrer">Sign in now</a></p>
    <p>You’ll be asked to set a new password on first login.</p>
    <hr />
    <small>If you didn’t expect this, you can safely ignore this email.</small>
  </div>`;

  const input: SendEmailCommandInput = {
    FromEmailAddress: SES_FROM_ADDRESS,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject },
        Body: { Text: { Data: text }, Html: { Data: html } },
      },
    },
  };

  await sesClient.send(new SendEmailCommand(input));
};

/**
 * Invite or re-invite a Cognito user (suppress default email, use SES instead)
 */
const inviteUser = async (params: { email: string }) => {
  const { email } = params;
  const tempPassword = generateTempPassword();

  try {
    // Check if user already exists
    await cognitoClient.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
    );

    // User exists → reset their password instead of creating a new user
    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        Password: tempPassword,
        Permanent: false,
      }),
    );

    console.log(`Re-invited existing user: ${email}`);
  } catch (err: any) {
    // If user not found, create and suppress default Cognito email
    if (err.name === 'UserNotFoundException') {
      const command = new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        TemporaryPassword: tempPassword,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
        MessageAction: MessageActionType.SUPPRESS,
      });
      await cognitoClient.send(command);
      console.log(`Created new user: ${email}`);
    } else {
      throw err;
    }
  }

  // Send invite email via SES
  await sendInviteEmail({ to: email, tempPassword, signinUrl: APP_SIGNIN_URL });

  return { success: true, email };
};

const signIn = async (params: { email: string; password: string }) => {
  const command = new AdminInitiateAuthCommand({
    UserPoolId: USER_POOL_ID,
    ClientId: USER_POOL_CLIENT_ID,
    AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
    AuthParameters: {
      USERNAME: params.email,
      PASSWORD: params.password,
    },
  });
  return await cognitoClient.send(command);
};

const respondToChallenge = async (params: {
  challengeName: string;
  session: string;
  newPassword: string;
  email: string;
}) => {
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

  return await cognitoClient.send(command);
};

export const authRouter = router({
  /**
   * Invite a new user by sending them an email (admin only)
   */
  inviteUser: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        console.log(`Inviting user via SES: ${input.email}`);

        const result = await inviteUser({
          email: input.email,
        });

        return {
          success: true,
          userEmail: result.email,
          message:
            'User invited successfully - a custom SES email with credentials was sent.',
        };
      } catch (error: any) {
        console.error('Error inviting user:', error);

        // Handle specific Cognito errors
        if (error.name === 'UsernameExistsException') {
          throw new Error('User already exists');
        }
        if (error.name === 'InvalidParameterException') {
          throw new Error('Invalid email format');
        }

        throw new Error(`Failed to invite user: ${error.message}`);
      }
    }),

  /**
   * Sign in an existing user
   */
  signIn: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(12),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        console.log(`Sign in attempt for: ${input.email}`);

        const result = await signIn({
          email: input.email,
          password: input.password,
        });

        // Handle authentication challenges (e.g., first-time login)
        if (result.ChallengeName) {
          return {
            success: false,
            challengeName: result.ChallengeName,
            challengeParameters: result.ChallengeParameters,
            session: result.Session,
            message: 'Additional authentication step required',
          };
        }

        // Successful authentication
        if (result.AuthenticationResult) {
          return {
            success: true,
            accessToken: result.AuthenticationResult.AccessToken,
            idToken: result.AuthenticationResult.IdToken,
            refreshToken: result.AuthenticationResult.RefreshToken,
            tokenType: result.AuthenticationResult.TokenType,
            expiresIn: result.AuthenticationResult.ExpiresIn,
            message: 'Sign in successful',
          };
        }

        throw new Error('Unexpected authentication result');
      } catch (error: any) {
        console.error('Error signing in user:', error);

        // Handle specific authentication errors
        if (error.name === 'NotAuthorizedException') {
          throw new Error('Invalid email or password');
        }
        if (error.name === 'UserNotConfirmedException') {
          throw new Error('User account not confirmed');
        }
        if (error.name === 'PasswordResetRequiredException') {
          throw new Error('Password reset required');
        }
        if (error.name === 'UserNotFoundException') {
          throw new Error('User not found');
        }

        throw new Error(`Sign in failed: ${error.message}`);
      }
    }),

  /**
   * Handle authentication challenges (e.g., setting new password on first login)
   */
  respondToChallenge: publicProcedure
    .input(
      z.object({
        challengeName: z.string(),
        session: z.string(),
        newPassword: z.string().min(10),
        email: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await respondToChallenge({
          challengeName: input.challengeName,
          session: input.session,
          newPassword: input.newPassword,
          email: input.email,
        });

        if (result.AuthenticationResult) {
          return {
            success: true,
            accessToken: result.AuthenticationResult.AccessToken,
            idToken: result.AuthenticationResult.IdToken,
            refreshToken: result.AuthenticationResult.RefreshToken,
            tokenType: result.AuthenticationResult.TokenType,
            expiresIn: result.AuthenticationResult.ExpiresIn,
            message: 'Password updated and sign in successful',
          };
        }

        throw new Error('Failed to respond to challenge');
      } catch (error: any) {
        console.error('Error responding to challenge:', error);
        throw new Error(`Challenge response failed: ${error.message}`);
      }
    }),
});
