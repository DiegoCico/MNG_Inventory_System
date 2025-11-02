import { initTRPC } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import type { APIGatewayProxyEventV2, Context as LambdaCtx } from 'aws-lambda';
import cookie from 'cookie';
import { COOKIE_ACCESS, COOKIE_ID } from '../helpers/cookies';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export type Context = {
  req?: Request;
  res?: Response;

  event?: APIGatewayProxyEventV2;
  lambdaContext?: LambdaCtx;

  responseHeaders?: Record<string, string | string[]>;
  responseCookies?: string[];
};

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
}): Promise<Context> => ({
  event,
  lambdaContext: context,
  responseHeaders: {},
  responseCookies: [], // <-- new
});

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_sP3HAecAw';
const USER_POOL_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '6vk8qbvjv6hvb99a0jjcpbth9k';

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  clientId: USER_POOL_CLIENT_ID,
  tokenUse: 'access',
});

const isAuthed = t.middleware(async ({ ctx, next }) => {
  // parse cookies from request
  const cookieHeader =
    ctx.req?.headers?.cookie ??
    ctx.event?.headers?.cookie ??
    (ctx.event?.headers as Record<string, string> | undefined)?.Cookie ??
    '';

  const cookies = cookie.parse(cookieHeader);

  // verify that access token exists
  const accessToken = cookies[COOKIE_ACCESS];
  if (!accessToken) {
    throw new Error('UNAUTHORIZED: No auth cookie found');
  }

  // veryify JWT with aws-jwt-verify and
  // pass user info to the next procedure
  try {
    const decode = await verifier.verify(accessToken);

    return next({
      ctx: {
        ...ctx,
        user: { decode },
      },
    });
  } catch (err) {
    throw new Error('INVALID_TOKEN');
  }
});