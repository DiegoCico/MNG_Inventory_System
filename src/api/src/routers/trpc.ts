import { initTRPC } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import type { APIGatewayProxyEventV2, Context as LambdaCtx } from 'aws-lambda';
import { COOKIE_ACCESS, parseCookiesFromCtx } from '../helpers/cookies';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export type Context = {
  req?: Request;
  res?: Response;
  event?: APIGatewayProxyEventV2;
  lambdaContext?: LambdaCtx;
  responseHeaders?: Record<string, string | string[]>;
  responseCookies?: string[];
  user?: {
    teamId: string;
    userId: string;
    email?: string;
    username?: string;
    decode?: Record<string, any>;
  };
};

/**
 * ===== Express Context =====
 * Used for local dev / testing.
 */
export const createExpressContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions): Context => ({
  req,
  res,
  responseHeaders: {},
  responseCookies: [],
});

export const createLambdaContext = async ({
  event,
  context,
}: {
  event: APIGatewayProxyEventV2;
  context: LambdaCtx;
}): Promise<Context> => {
  return {
    event,
    lambdaContext: context,
    responseHeaders: {},
    responseCookies: [],
  };
};

/**
 * ===== TRPC Initialization =====
 */
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;

/**
 * ===== Cognito Token Verification =====
 * Used by protectedProcedure to validate user access tokens from cookies.
 */
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_sP3HAecAw';
const USER_POOL_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '6vk8qbvjv6hvb99a0jjcpbth9k';

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  clientId: USER_POOL_CLIENT_ID,
  tokenUse: 'access',
});

/**
 * ===== Auth Middleware =====
 * Extracts cookies, validates JWT, attaches user info to context.
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
  const cookies = parseCookiesFromCtx(ctx);
  const accessToken = cookies[COOKIE_ACCESS];

  if (!accessToken) {
    throw new Error('UNAUTHORIZED: No auth cookie found');
  }

  try {
    const decoded = await verifier.verify(accessToken);

    // Attach user info
    return next({
      ctx: {
        ...ctx,
        user: {
          teamId: decoded.sub,
          userId: decoded.sub,
          email: decoded.email ?? undefined,
          username: decoded['cognito:username'],
          decode: decoded,
        },
      },
    });
  } catch (err) {
    throw new Error(`INVALID_TOKEN: ${err instanceof Error ? err.message : String(err)}`);
  }
});

export const protectedProcedure = t.procedure.use(isAuthed);
