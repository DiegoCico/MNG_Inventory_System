import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import * as trpcExpress from "@trpc/server/adapters/express";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context as LambdaCtx,
} from "aws-lambda";
import express from "express";
import { appRouter, createContext as baseCreateContext } from "./routers";

// config
const CONFIG = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  STAGE: process.env.STAGE ?? "dev",
  SERVICE_NAME: process.env.SERVICE_NAME ?? "mng-api",
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? "*",
  CORS_HEADERS: process.env.CORS_HEADERS ?? "content-type,authorization",
  CORS_METHODS: process.env.CORS_METHODS ?? "GET,POST,PUT,PATCH,DELETE,OPTIONS",
} as const;

/**  Types  */
type HeaderMap = Record<string, string>; // API GW & tRPC both end up string-only
type CorsHeaders = Partial<HeaderMap>;
type TrpcHeaders = Record<string, string | string[] | undefined>;

/**  Utils  */
const parseAllowed = (csvOrStar: string) =>
  csvOrStar === "*"
    ? ["*"]
    : csvOrStar.split(",").map((s) => s.trim()).filter(Boolean);

function getRequestOrigin(h?: Record<string, string | undefined>): string | undefined {
  if (!h) return undefined;
  const map: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(h)) map[k.toLowerCase()] = v;
  return map["origin"] ?? map["referer"];
}

/** Coerce arbitrary values to string-only header map (safe for API Gateway) */
function toHeaderMap(h: Record<string, unknown>): HeaderMap {
  const out: HeaderMap = {};
  for (const [k, v] of Object.entries(h)) {
    if (v == null) continue;
    if (Array.isArray(v)) out[k] = v.map((x) => String(x)).join(", ");
    else out[k] = String(v);
  }
  return out;
}

/** For tRPC ResponseMeta.headers (HTTPHeaders) */
function toTrpcHeaders(h: Record<string, unknown>): TrpcHeaders {
  const out: TrpcHeaders = {};
  for (const [k, v] of Object.entries(h)) {
    if (v == null) continue;
    if (Array.isArray(v)) out[k] = v.map((x) => String(x));
    else out[k] = String(v);
  }
  return out;
}

/**
 * If CORS_ORIGINS="*", we must NOT set Allow-Credentials and we return wildcard.
 * If explicit origins are configured, we echo the matched origin + set Allow-Credentials=true.
 */
function corsHeadersFrom(origin?: string): CorsHeaders {
  const allowList = parseAllowed(CONFIG.CORS_ORIGINS);
  const wildcard = allowList.length === 1 && allowList[0] === "*";

  if (wildcard) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": CONFIG.CORS_HEADERS,
      "Access-Control-Allow-Methods": CONFIG.CORS_METHODS,
      Vary: "Origin",
      // no credentials with wildcard
    };
  }

  const match = origin && allowList.includes(origin) ? origin : allowList[0]; // fallback to first allowed
  return {
    "Access-Control-Allow-Origin": match,
    "Access-Control-Allow-Headers": CONFIG.CORS_HEADERS,
    "Access-Control-Allow-Methods": CONFIG.CORS_METHODS,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function resolveRuntimeRegion(event: APIGatewayProxyEventV2, context: LambdaCtx): string {
  const fromEnv =
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? (process.env as any).AWS_REGION_DEFAULT;
  if (fromEnv) return fromEnv;

  // ARN format: arn:aws:lambda:us-east-1:acct:function:name
  if (typeof context?.invokedFunctionArn === "string") {
    const parts = context.invokedFunctionArn.split(":");
    if (parts.length >= 4 && parts[3]) return parts[3];
  }

  // API Gateway V2 may include region in requestContext
  const rcAny = event?.requestContext as any;
  const rcRegion: string | undefined = rcAny?.region ?? rcAny?.awsRegion;
  if (rcRegion) return rcRegion;

  return "us-east-1";
}

let coldStart = true;

/**  Lambda entry (tRPC over API Gateway HTTP API v2)  */
export const handler = async (
  event: APIGatewayProxyEventV2,
  context: LambdaCtx
): Promise<APIGatewayProxyStructuredResultV2> => {
  const origin = getRequestOrigin(event?.headers);
  const baseCors = corsHeadersFrom(origin);

  // CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: toHeaderMap(baseCors), body: "" };
  }

  const meta = {
    requestId: event?.requestContext?.requestId ?? context.awsRequestId,
    region: resolveRuntimeRegion(event, context),
    stage: CONFIG.STAGE,
    service: CONFIG.SERVICE_NAME,
    coldStart,
  };

  const proxy = awsLambdaRequestHandler({
    router: appRouter,
    createContext: () =>
      (baseCreateContext as any)({
        event,
        context,
        aws: meta,
      }),
    batching: { enabled: true },
    responseMeta() {
      // Ensure CORS + diagnostics headers are on every tRPC response
      return {
        headers: toTrpcHeaders({
          ...baseCors,
          "x-aws-region": meta.region,
          "x-stage": meta.stage,
          "x-svc": meta.service,
          "x-cold-start": String(meta.coldStart),
        }),
      };
    },
  });

  const res = await proxy(event, context);
  coldStart = false;
  return res;
};

/**  Local dev server (mirrors Lambda)  */
if (CONFIG.NODE_ENV === "development") {
  const app = express();

  // Uniform CORS for all routes (credentials-aware)
  app.use((req, res, next) => {
    const ch = corsHeadersFrom(req.header("Origin") || req.header("origin") || undefined);
    for (const [k, v] of Object.entries(ch)) if (v != null) res.header(k, String(v));
    next();
  });

  // Explicit preflight responder
  app.options("*", (req, res) => {
    const ch = corsHeadersFrom(req.header("Origin") || req.header("origin") || undefined);
    res.status(204).set(toHeaderMap(ch)).send();
  });

  // tRPC route
  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) =>
        (baseCreateContext as any)({
          req,
          res,
          aws: {
            requestId: "local-dev",
            region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
            stage: CONFIG.STAGE,
            service: CONFIG.SERVICE_NAME,
            coldStart: false,
          },
        }),
      batching: { enabled: true },
    })
  );

  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(`[local] ${CONFIG.SERVICE_NAME} running at http://localhost:${port}`);
  });
}
