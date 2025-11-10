import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from './trpc';
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
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  setAuthCookies,
  clearAuthCookies,
  parseCookiesFromCtx,
  emitCookiesToLambda,
  COOKIE_ACCESS,
} from '../helpers/cookies';
import { decodeJwtNoVerify } from '../helpers/authUtils';
import { ensureUserRecord } from '../helpers/awsUsers';
import { loadConfig } from '../process';

const config = loadConfig();
export const USER_POOL_ID = config.COGNITO_USER_POOL_ID;
export const USER_POOL_CLIENT_ID = config.COGNITO_CLIENT_ID;
export const SES_FROM_ADDRESS = config.SES_FROM;
export const APP_SIGNIN_URL = config.APP_SIGNIN_URL || `${config.WEB_URL}/signin`;

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  clientId: USER_POOL_CLIENT_ID,
  tokenUse: 'access',
});

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
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
    );

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
    if (err.name === 'UserNotFoundException') {
      await cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          TemporaryPassword: tempPassword,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
          ],
          MessageAction: MessageActionType.SUPPRESS,
        }),
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
    ClientId: USER_POOL_CLIENT_ID,
    AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
    AuthParameters: { USERNAME: params.email, PASSWORD: params.password },
  });
  return await cognitoClient.send(command);
};

export const authRouter = router({
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

        if (error.name === 'UsernameExistsException') {
          throw new Error('User already exists');
        }
        if (error.name === 'InvalidParameterException') {
          throw new Error('Invalid email format');
        }

        throw new Error(`Failed to invite user: ${error.message}`);
      }
    }),

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
          if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
            return {
              success: false,
              challengeName: result.ChallengeName,
              challengeParameters: result.ChallengeParameters,
              session: result.Session,
              message: 'Password change required',
            };
          }

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

        // Successful authentication - return tokens + set cookies
        if (result.AuthenticationResult) {
          // Set cookies for Express OR stash them for Lambda adapter
          const headers = setAuthCookies(ctx.res, {
            AccessToken: result.AuthenticationResult.AccessToken ?? null,
            IdToken: result.AuthenticationResult.IdToken ?? null,
            RefreshToken: result.AuthenticationResult.RefreshToken ?? null,
            ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
          });

          emitCookiesToLambda(ctx, headers);

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
        // build ChallengeResponses
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

        // More challenge?
        if (result.ChallengeName) {
          return {
            success: false,
            challengeName: result.ChallengeName,
            challengeParameters: result.ChallengeParameters,
            session: result.Session,
            message: 'Additional authentication step required',
          };
        }

        // Success => set cookies
        if (result.AuthenticationResult) {
          const headers = setAuthCookies(ctx.res, {
            AccessToken: result.AuthenticationResult.AccessToken ?? null,
            IdToken: result.AuthenticationResult.IdToken ?? null,
            RefreshToken: result.AuthenticationResult.RefreshToken ?? null,
            ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
          });
          emitCookiesToLambda(ctx, headers);

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
  const cookies = parseCookiesFromCtx(ctx);
  const accessToken = cookies[COOKIE_ACCESS];

  if (!accessToken) {
    return { authenticated: false, message: 'No session' };
  }

  let decoded;
  try {
    decoded = await verifier.verify(accessToken);
  } catch (err: any) {
    console.error('me() token verification error:', err);
    return { authenticated: false, message: `Invalid session token: ${err.message}` };
  }

  const userId = decoded.sub;

  // --- Get user record from DynamoDB ---
  const { doc } = await import("../aws");
  const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
  const TABLE_NAME = config.TABLE_NAME;

  let record;
  try {
    const res = await doc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: "METADATA" },
      })
    );
    record = res.Item;
  } catch (err) {
    console.error("me() DynamoDB fetch error:", err);
  }

  // --- fallback name/role ---
  const emailStr = typeof decoded.email === "string" ? decoded.email : "";
  const name =
    record?.name ||
    decoded["cognito:username"] ||
    (emailStr ? emailStr.split("@")[0] : "User");

  const role = record?.role || "User";


  const email =
    decoded.email ||
    decoded["email"] ||
    decoded["cognito:username"] ||
    record?.email ||
    `${userId}@example.com`;

  return {
    authenticated: true,
    userId,
    email,
    name,
    role,
    message: "User session verified",
  };
}),


  refresh: publicProcedure.mutation(async ({ ctx }) => {
    try {
      const cookies = parseCookiesFromCtx(ctx);
      const refreshToken = cookies['auth_refresh'];

      if (!refreshToken) {
        return { refreshed: false, message: 'No refresh token' };
      }

      // call Cognito REFRESH_TOKEN_AUTH
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

      const headers = setAuthCookies(ctx.res, {
        AccessToken: result.AuthenticationResult.AccessToken ?? null,
        IdToken: result.AuthenticationResult.IdToken ?? null,
        ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
      });
      emitCookiesToLambda(ctx, headers);

      const newAccess = result.AuthenticationResult.AccessToken ?? null;
      const newId = result.AuthenticationResult.IdToken ?? null;

      // decode new token so we know who's calling
      const decoded = decodeJwtNoVerify(newId) || decodeJwtNoVerify(newAccess);

      if (!decoded || !decoded.sub) {
        return {
          refreshed: false,
          message: 'Token refresh succeeded but could not decode user identity',
        };
      }

      // upsert/get user in Dynamo
      const userRecord = await ensureUserRecord({
        sub: decoded.sub,
        email: decoded.email ?? 'unknown@example.com',
      });

      // respond
      return {
        refreshed: true,
        expiresIn: result.AuthenticationResult.ExpiresIn,
        sub: userRecord.sub,
        email: userRecord.email,
        accountId: userRecord.accountId,
      };
    } catch (err) {
      console.error('refresh error:', err);
      return { refreshed: false, message: 'Token refresh failed' };
    }
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    const headers = clearAuthCookies(ctx.res);
    emitCookiesToLambda(ctx, headers);
    return { success: true, message: 'Signed out' };
  }),
});
