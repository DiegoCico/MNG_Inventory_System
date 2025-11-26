import { initTRPC } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import type { APIGatewayProxyEventV2, Context as LambdaCtx } from 'aws-lambda';
import { COOKIE_ACCESS, parseCookiesFromCtx } from '../helpers/cookies';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { getUserPermissions } from '../helpers/teamspaceHelpers';
import { TRPCError } from '@trpc/server';
import type { Permission } from './roles';

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
    email?: string | undefined;
    username?: string;
    roleName?: string;
    permissions?: string[];
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
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No access token',
    });
  }

  try {
    const decoded = await verifier.verify(accessToken);

    // Normalize email to a string at runtime to keep things predictable
    const emailValue =
      decoded.email !== undefined && decoded.email !== null ? String(decoded.email) : undefined;

    // Attach user info
    const { roleName, permissions } = await getUserPermissions(decoded.sub);

    return next({
      ctx: {
        ...ctx,
        user: {
          teamId: decoded.sub,
          userId: decoded.sub,
          email: emailValue,
          username:
            decoded['cognito:username'] !== null ? String(decoded['cognito:username']) : undefined,
          roleName,
          permissions,
          decode: decoded,
        },
      },
    });
  } catch (err: any) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: `Invalid or expired token: ${err?.message ?? String(err)}`,
    });
  }
});

export const protectedProcedure = t.procedure.use(isAuthed);

// --------- Permission middleware factory ----------
export function requirePermission(requiredPermission: Permission) {
  return async ({ ctx, next }: { ctx: Context; next: any }) => {
    const user = ctx.user;
    if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing user in context' });

    if (!user.permissions || !Array.isArray(user.permissions)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'User has no permissions assigned' });
    }

    if (!user.permissions.includes(requiredPermission)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }

    return next();
  };
}

export const permissionedProcedure = (perm: Permission) =>
  protectedProcedure.use(requirePermission(perm));
