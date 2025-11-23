import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure, permissionedProcedure } from './trpc';
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
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User already exists',
          });
        }
        if (error.name === 'InvalidParameterException') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid email format',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to invite user: ${error.message}`,
        });
      }
    }),

  signIn: publicProcedure
    .input(
      z.object({
        email: z.string(),
        password: z.string().min(10),
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

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unexpected authentication result',
        });
      } catch (error: any) {
        console.error('Error signing in user:', error);

        if (error.name === 'NotAuthorizedException') {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',
          });
        }
        if (error.name === 'UserNotConfirmedException') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'User account not confirmed',
          });
        }
        if (error.name === 'PasswordResetRequiredException') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Password reset required',
          });
        }
        if (error.name === 'UserNotFoundException') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Sign in failed: ${error.message}`,
        });
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

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to respond to challenge',
        });
      } catch (error: any) {
        console.error('Error responding to challenge:', error);

        if (error.name === 'CodeMismatchException') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid code',
          });
        }
        if (error.name === 'ExpiredCodeException') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Code expired',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Challenge response failed: ${error.message}`,
        });
      }
    }),
  // ------------------------------
  // me()
  // ------------------------------
  me: publicProcedure.query(async ({ ctx }) => {
    const cookies = parseCookiesFromCtx(ctx);
    const accessToken = cookies[COOKIE_ACCESS];

    if (!accessToken) {
      return { authenticated: false, message: 'No session' };
    }

    // 1. VERIFY TOKEN
    let decoded;
    try {
      decoded = await verifier.verify(accessToken);
    } catch (err: any) {
      console.error('me() token verification error:', err);
      return { authenticated: false, message: 'Invalid session' };
    }

    const userId = decoded.sub;

    // 2. LOOK UP USER IN DYNAMODB
    const { doc } = await import('../aws');
    const { GetCommand, PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const TABLE = config.TABLE_NAME;

    let user: any = null;

    try {
      const res = await doc.send(
        new GetCommand({
          TableName: TABLE,
          Key: { PK: `USER#${userId}`, SK: 'METADATA' },
        }),
      );
      user = res.Item || null;
    } catch (err) {
      console.error('me() DynamoDB Get error:', err);
    }

    // 3. CREATE USER IF MISSING
    if (!user) {
      const now = new Date().toISOString();
      const username = 'user-' + Math.random().toString(36).substring(2, 8);
      const accountId = crypto.randomUUID();

      user = {
        PK: `USER#${userId}`,
        SK: 'METADATA',
        sub: userId,
        username,
        name: username,
        role: 'Owner',
        accountId,
        createdAt: now,
        updatedAt: now,
        GSI6PK: `UID#${userId}`,
        GSI6SK: `USER#${userId}`,
      };

      try {
        await doc.send(
          new PutCommand({
            TableName: TABLE,
            Item: user,
          }),
        );
        console.log('Created new DynamoDB user record:', user);
      } catch (err) {
        console.error('FAILED TO CREATE USER RECORD:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not create user record',
        });
      }
    }

    // 4. RETURN PROFILE (NOW INCLUDES accountId)
    return {
      authenticated: true,
      userId,
      name: user.name,
      username: user.username,
      role: user.role,
      accountId: user.accountId,
    };
  }),

  // ------------------------------
  // refresh()
  // ------------------------------
  refresh: publicProcedure.mutation(async ({ ctx }) => {
    try {
      const cookies = parseCookiesFromCtx(ctx);
      const refreshToken = cookies['auth_refresh'];

      if (!refreshToken) {
        return { refreshed: false, message: 'No refresh token' };
      }

      // 1. REQUEST NEW TOKENS FROM COGNITO
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

      // 2. SET NEW COOKIES
      const headers = setAuthCookies(ctx.res, {
        AccessToken: result.AuthenticationResult.AccessToken ?? null,
        IdToken: result.AuthenticationResult.IdToken ?? null,
        ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
      });
      emitCookiesToLambda(ctx, headers);

      // 3. DECODE NEW TOKENS
      const newAccess = result.AuthenticationResult.AccessToken;
      const newId = result.AuthenticationResult.IdToken;

      const decoded = decodeJwtNoVerify(newId) || decodeJwtNoVerify(newAccess);

      if (!decoded || !decoded.sub) {
        return {
          refreshed: false,
          message: 'Token refresh succeeded but missing userId (sub)',
        };
      }

      const userId = decoded.sub;

      // 4. CREATE OR FIX USER RECORD (ensureUserRecord always returns username + accountId)
      const record = await ensureUserRecord({ sub: userId });

      return {
        refreshed: true,
        userId,
        username: record.username,
        accountId: record.accountId,
        authenticated: true,
        expiresIn: result.AuthenticationResult.ExpiresIn,
      };
    } catch (err) {
      console.error('refresh error:', err);
      return { refreshed: false, message: 'Token refresh failed' };
    }
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const headers = clearAuthCookies(ctx.res);
    emitCookiesToLambda(ctx, headers);
    return { success: true, message: 'Signed out' };
  }),
});
