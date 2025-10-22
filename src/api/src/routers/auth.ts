import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import {
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  MessageActionType,
  AuthFlowType,
  ChallengeNameType,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';
import { cognitoClient } from '../aws';
import { sendInviteEmail } from '../helpers/inviteEmail';
import { setAuthCookies, clearAuthCookies } from '../helpers/cookies';
import cookie from 'cookie';

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_sP3HAecAw';
const USER_POOL_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '6vk8qbvjv6hvb99a0jjcpbth9k';
// export const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS || 'cicotoste.d@northeastern.edu';
const APP_SIGNIN_URL = process.env.APP_SIGNIN_URL || 'https://d2cktegyq4qcfk.cloudfront.net/signin';

/**
 * Helper: Generate a random temporary password that satisfies Cognito's password policy
 */
const generateTempPassword = (): string => {
  const base = crypto.randomBytes(6).toString('base64');
  const extras = 'Aa1!';
  return (base + extras).slice(0, 16);
};

const inviteUser = async (params: { email: string }) => {
  const { email } = params;
  const tempPassword = generateTempPassword();

  try {
    await cognitoClient.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email })
    );

    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        Password: tempPassword,
        Permanent: false,
      })
    );
    console.log(`Re-invited existing user: ${email}`);
  } catch (err: any) {
    if (err.name === "UserNotFoundException") {
      await cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          TemporaryPassword: tempPassword,
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "true" },
          ],
          // keep Cognito silent; we send the invite via SES
          MessageAction: MessageActionType.SUPPRESS,
        })
      );
      console.log(`Created new user: ${email}`);
    } else {
      throw err;
    }
  }

  // Custom SES invite with temp password
  await sendInviteEmail({ to: email, tempPassword, signinUrl: APP_SIGNIN_URL });

  return { success: true, email };
};

const signIn = async (params: { email: string; password: string }) => {
    const command = new AdminInitiateAuthCommand({
    UserPoolId: USER_POOL_ID,
    ClientId: USER_POOL_CLIENT_ID,             // must be your current no-secret client
    AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
    AuthParameters: { USERNAME: params.email, PASSWORD: params.password },
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
        email: z.string(),
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
          message: 'User invited successfully - a custom SES email with credentials was sent.',
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
        email: z.string(),
        password: z.string().min(12),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(`Sign in attempt for: ${input.email}`);

        const result = await signIn({
          email: input.email,
          password: input.password,
        });

        // Handle authentication challenges
        if (result.ChallengeName) {
          // Handle password change challenge
          if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
            return {
              success: false,
              challengeName: result.ChallengeName,
              challengeParameters: result.ChallengeParameters,
              session: result.Session,
              message: 'Password change required',
            };
          }

          // Handle email MFA challenge from Cognito
          if (result.ChallengeName === 'EMAIL_OTP') {
            return {
              success: false,
              challengeName: result.ChallengeName,
              challengeParameters: result.ChallengeParameters,
              session: result.Session,
              message: 'MFA code sent to your email by Cognito',
            };
          }

          return {
            success: false,
            challengeName: result.ChallengeName,
            challengeParameters: result.ChallengeParameters,
            session: result.Session,
            message: 'Additional authentication step required',
          };
        }

        // Successful authentication - return tokens immediately
        if (result.AuthenticationResult) {
          if (ctx.res) {
            setAuthCookies(ctx.res, {
              AccessToken: result.AuthenticationResult.AccessToken ?? null,
              IdToken: result.AuthenticationResult.IdToken ?? null,
              RefreshToken: result.AuthenticationResult.RefreshToken ?? null,
              ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
            });
          }

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
      z
        .object({
          challengeName: z.string(),
          session: z.string(),
          newPassword: z.string().min(10).optional(),
          mfaCode: z.string().optional(),
          email: z.string(),
        })
        .refine(
          (data) => {
            const mfaChallenges = new Set(['EMAIL_OTP', 'SMS_MFA', 'SOFTWARE_TOKEN_MFA']);
            if (data.challengeName === 'NEW_PASSWORD_REQUIRED') {
              return !!data.newPassword;
            }
            if (mfaChallenges.has(data.challengeName)) {
              return !!data.mfaCode;
            }
            return true;
          },
          {
            message:
              'newPassword required for NEW_PASSWORD_REQUIRED; mfaCode required for EMAIL_OTP/SMS_MFA/SOFTWARE_TOKEN_MFA',
          },
        ),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Map the right response key based on challenge
        const responses: Record<string, string> = { USERNAME: input.email };
        switch (input.challengeName) {
          case 'NEW_PASSWORD_REQUIRED':
            responses.NEW_PASSWORD = input.newPassword!;
            break;
          case 'EMAIL_OTP':
            responses.EMAIL_OTP_CODE = input.mfaCode!;
            break;
          case 'SMS_MFA':
            responses.SMS_MFA_CODE = input.mfaCode!;
            break;
          case 'SOFTWARE_TOKEN_MFA':
            responses.SOFTWARE_TOKEN_MFA_CODE = input.mfaCode!;
            break;
          default:
            // leave as-is for other challenges (e.g., SELECT_MFA_TYPE/MFA_SETUP)
            break;
        }

        const command = new AdminRespondToAuthChallengeCommand({
          UserPoolId: USER_POOL_ID,
          ClientId: USER_POOL_CLIENT_ID,
          ChallengeName: input.challengeName as ChallengeNameType,
          Session: input.session,
          ChallengeResponses: responses,
        });

        const result = await cognitoClient.send(command);

        // Another challenge? Surface it
        if (result.ChallengeName) {
          return {
            success: false,
            challengeName: result.ChallengeName,
            challengeParameters: result.ChallengeParameters,
            session: result.Session,
            message: 'Additional authentication step required',
          };
        }

        // Success → set cookies
        if (result.AuthenticationResult) {
          if (ctx.res) {
            setAuthCookies(ctx.res, {
              AccessToken: result.AuthenticationResult.AccessToken ?? null,
              IdToken: result.AuthenticationResult.IdToken ?? null,
              RefreshToken: result.AuthenticationResult.RefreshToken ?? null,
              ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
            });
          }

          return {
            success: true,
            accessToken: result.AuthenticationResult.AccessToken,
            idToken: result.AuthenticationResult.IdToken,
            refreshToken: result.AuthenticationResult.RefreshToken,
            tokenType: result.AuthenticationResult.TokenType,
            expiresIn: result.AuthenticationResult.ExpiresIn,
            message:
              input.challengeName === 'NEW_PASSWORD_REQUIRED'
                ? 'Password updated and sign in successful'
                : 'MFA/OTP verification successful',
          };
        }

        throw new Error('Failed to respond to challenge');
      } catch (error: any) {
        console.error('Error responding to challenge:', error);

        // fine-grained MFA errors
        if (error.name === 'CodeMismatchException') {
          throw new Error('Invalid code');
        }
        if (error.name === 'ExpiredCodeException') {
          throw new Error('Code expired');
        }

        throw new Error(`Challenge response failed: ${error.message}`);
      }
    }),


  me: publicProcedure.query(async ({ ctx }) => {
    const cookieHeader =
      ctx.req?.headers?.cookie ??
      ctx.event?.headers?.cookie ??
      (ctx.event?.headers as Record<string, string> | undefined)?.Cookie ??
      '';
    const cookies = cookie.parse(cookieHeader);

    const hasSession =
      Boolean(cookies.auth_access) || Boolean(cookies.auth_id) || Boolean(cookies.auth_refresh);

    if (hasSession) {
      return { authenticated: true, message: 'User session found' };
    } else {
      return { authenticated: false, message: 'No session' };
    }
  }),

  refresh: publicProcedure.mutation(async ({ ctx }) => {
    try {
      const cookieHeader =
        ctx.req?.headers?.cookie ??
        ctx.event?.headers?.cookie ??
        (ctx.event?.headers as Record<string, string> | undefined)?.Cookie ??
        '';
      const cookies = cookie.parse(cookieHeader);
      const refreshToken = cookies['auth_refresh'];

      if (!refreshToken) {
        return { refreshed: false, message: 'No refresh token' };
      }

      const cmd = new InitiateAuthCommand({
        ClientId: USER_POOL_CLIENT_ID,
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const result = await cognitoClient.send(cmd);

      if (!result.AuthenticationResult) {
        return { refreshed: false, message: 'Token refresh failed' };
      }

      if (ctx.res) {
        setAuthCookies(ctx.res, {
          AccessToken: result.AuthenticationResult.AccessToken ?? null,
          IdToken: result.AuthenticationResult.IdToken ?? null,
          ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
        });
      }

      return { refreshed: true, expiresIn: result.AuthenticationResult.ExpiresIn };
    } catch (err) {
      console.error('refresh error:', err);
      return { refreshed: false, message: 'Token refresh failed' };
    }
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.res) {
      clearAuthCookies(ctx.res);
    }
    return { success: true, message: 'Signed out' };
  }),
});
