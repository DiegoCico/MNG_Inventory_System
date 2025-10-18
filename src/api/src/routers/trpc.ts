// src/routers/trpc.ts
import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import type { Request, Response } from "express";
import type { APIGatewayProxyEventV2, Context as LambdaCtx } from "aws-lambda";

/**
 * Runtime-agnostic tRPC Context.
 * - In Express, only (req,res) will be set.
 * - In Lambda, only (event, lambdaContext) will be set.
 */
export type Context = {
  // Express (local/dev)
  req?: Request;
  res?: Response;

  // Lambda (API Gateway)
  event?: APIGatewayProxyEventV2;
  lambdaContext?: LambdaCtx;

  // Optional scratchpad for response headers/cookies
  responseHeaders?: Record<string, string | string[]>;
};

/** Context factory for Express adapter */
export const createExpressContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions): Context => ({
  req,
  res,
  responseHeaders: {},
});

/** Context factory for aws-lambda adapter (no helper generic needed) */
export const createLambdaContext = async (
  { event, context }: { event: APIGatewayProxyEventV2; context: LambdaCtx }
): Promise<Context> => ({
  event,
  lambdaContext: context,
  responseHeaders: {},
});

/** Helper: read cookie header across runtimes safely */
export function getCookieHeader(ctx: Context): string {
  // Express
  const fromExpress = ctx.req?.headers?.cookie;
  if (fromExpress) return fromExpress;

  // API Gateway v2 (HTTP API) often lowercases headers
  const fromLambda =
    ctx.event?.headers?.cookie ??
    (ctx.event?.headers as Record<string, string> | undefined)?.Cookie;

  return fromLambda ?? "";
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;
