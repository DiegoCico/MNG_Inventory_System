import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import * as trpcExpress from "@trpc/server/adapters/express";
import type { APIGatewayProxyEventV2, Context as LambdaCtx } from "aws-lambda";
import express from "express";
import { appRouter, createContext as baseCreateContext } from "./routers";

const CONFIG = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  STAGE: process.env.STAGE ?? "dev",
  SERVICE_NAME: process.env.SERVICE_NAME ?? "mng-api",
  AWS_REGION: process.env.AWS_REGION ?? "us-east-1",
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? "*",
  CORS_HEADERS: process.env.CORS_HEADERS ?? "*",
  CORS_METHODS: process.env.CORS_METHODS ?? "GET,POST,OPTIONS",
};

// CORS
const corsHeaders = () => ({
  "Access-Control-Allow-Origin": CONFIG.CORS_ORIGINS,
  "Access-Control-Allow-Headers": CONFIG.CORS_HEADERS,
  "Access-Control-Allow-Methods": CONFIG.CORS_METHODS,
});

let coldStart = true;
const extractAwsMeta = (event: any, context: LambdaCtx) => ({
  requestId: event?.requestContext?.requestId ?? context.awsRequestId,
  region: CONFIG.AWS_REGION,
  stage: CONFIG.STAGE,
  service: CONFIG.SERVICE_NAME,
  coldStart,
});

// Lambda handler 
export const handler = async (event: APIGatewayProxyEventV2, context: LambdaCtx) => {
  if (event.requestContext?.http?.method === "OPTIONS")
    return { statusCode: 204, headers: corsHeaders(), body: "" };

  const meta = extractAwsMeta(event, context);
  const response = await awsLambdaRequestHandler({
    router: appRouter,
    createContext: () => (baseCreateContext as any)({ event, context, aws: meta }),
    batching: { enabled: true },
    responseMeta() {
      return {
        headers: {
          ...corsHeaders(),
          "x-aws-region": meta.region,
          "x-stage": meta.stage,
          "x-svc": meta.service,
          "x-cold-start": String(meta.coldStart),
        },
      };
    },
  })(event, context);

  coldStart = false;
  return response;
};

// local dev server when NODE_ENV=development
if (CONFIG.NODE_ENV === "development") {
  const app = express();

  // basic CORS
  app.use((_, res, next) => {
    res.header("Access-Control-Allow-Origin", CONFIG.CORS_ORIGINS);
    res.header("Access-Control-Allow-Headers", CONFIG.CORS_HEADERS);
    res.header("Access-Control-Allow-Methods", CONFIG.CORS_METHODS);
    next();
  });

  // tRPC route
  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) =>
        (baseCreateContext as any)({ req, res, aws: { stage: CONFIG.STAGE, region: CONFIG.AWS_REGION, service: CONFIG.SERVICE_NAME } }),
    })
  );

  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(`[local] ${CONFIG.SERVICE_NAME} running at http://localhost:${port}`);
  });
}
