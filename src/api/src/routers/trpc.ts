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

/*                          Express Context (local dev)                       */
export const createExpressContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions): Context => ({
  req,
  res,
  responseHeaders: {},
  responseCookies: [],
});

/*                           Lambda Context (AWS)                             */
export const createLambdaContext = async ({
  event,
  context,
}: {
  event: APIGatewayProxyEventV2;
  context: LambdaCtx;
}): Promise<Context> => {
  const responseCookies: string[] = [];

  // Fake minimal Express-like res object
  const fakeRes = {
    _headers: {} as Record<string, string[]>,
    getHeader(name: string) {
      return this._headers[name];
    },
    setHeader(name: string, value: string | string[]) {
      const lower = name.toLowerCase();
      if (lower === "set-cookie") {
        const arr = Array.isArray(value) ? value : [value];
        responseCookies.push(...arr);
        this._headers["Set-Cookie"] = [
          ...(this._headers["Set-Cookie"] ?? []),
          ...arr,
        ];
        console.log("🍪 [fakeRes.setHeader] Captured cookies:", arr);
      } else {
        this._headers[name] = Array.isArray(value) ? value : [value];
      }
    },
  };

  return {
    event,
    lambdaContext: context,
    res: fakeRes as unknown as Response,
    responseHeaders: {},
    responseCookies,
  };
};

/*                             tRPC Initialization                            */
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;
