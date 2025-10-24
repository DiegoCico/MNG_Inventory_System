import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import type { Request, Response } from "express";
import type { APIGatewayProxyEventV2, Context as LambdaCtx } from "aws-lambda";

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
