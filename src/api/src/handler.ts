// src/lambda.ts
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context as LambdaCtx,
} from "aws-lambda";
import { appRouter } from "./routers";
import { createLambdaContext } from "./routers/trpc";

/** Resolve allowed origin from env allowlist or reflect request */
function resolveAllowedOrigin(originHeader: string | undefined): string {
  const allow = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0) return originHeader ?? "*";
  if (originHeader && allow.includes(originHeader)) return originHeader;
  return allow[0] ?? originHeader ?? "*";
}

function buildCorsHeaders(
  originHeader: string | undefined,
  includeCreds = true,
  includeMethodsHeaders = true
): Record<string, string> {
  const allowOrigin = resolveAllowedOrigin(originHeader);

  const h: Record<string, string> = {
    "access-control-allow-origin": allowOrigin,
    vary: "Origin",
  };

  if (includeCreds) {
    h["access-control-allow-credentials"] = "true";
  }

  if (includeMethodsHeaders) {
    h["access-control-allow-methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
    h["access-control-allow-headers"] =
      "content-type,authorization,x-requested-with";
  }

  return h;
}

/** Handle preflight (if OPTIONS is routed to Lambda) */
function handleOptions(
  event: APIGatewayProxyEventV2
): APIGatewayProxyStructuredResultV2 {
  const origin =
    (event.headers?.origin ??
      (event.headers as any)?.Origin) as string | undefined;
  return { statusCode: 204, headers: buildCorsHeaders(origin, true, true) };
}

/** Main Lambda handler that wraps tRPC */
export const lambdaHandler = async (
  event: APIGatewayProxyEventV2,
  ctx: LambdaCtx
): Promise<APIGatewayProxyStructuredResultV2> => {
  // Preflight
  if ((event.requestContext?.http?.method ?? "").toUpperCase() === "OPTIONS") {
    return handleOptions(event);
  }

  return awsLambdaRequestHandler({
    router: appRouter,
    createContext: createLambdaContext, // <-- Lambda context factory
    responseMeta({ errors }) {
      const origin =
        (event.headers?.origin ??
          (event.headers as any)?.Origin) as string | undefined;

      if (errors?.length) {
        const status = (errors[0] as any)?.data?.httpStatus ?? 500;
        return { status, headers: buildCorsHeaders(origin, true, false) };
      }
      return { headers: buildCorsHeaders(origin, true, false) };
    },
  })(event, ctx);
};

// AWS entrypoint
export const handler = lambdaHandler;
