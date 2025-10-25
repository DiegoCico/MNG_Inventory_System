import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context as LambdaCtx,
} from "aws-lambda";
import { appRouter } from "./routers";
import { createLambdaContext } from "./routers/trpc";

function resolveAllowedOrigin(originHeader: string | undefined): string {
  const allow = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // no origin header? use first allowed if present
  if (!originHeader) return allow[0] ?? "";

  // if no explicit allowlist configured, just reflect the origin
  if (allow.length === 0) return originHeader;

  // if request origin is in allowlist, echo it
  if (allow.includes(originHeader)) return originHeader;

  // fallback to first allowed
  return allow[0] ?? originHeader;
}

function buildCorsHeaders(
  originHeader: string | undefined,
  includeCreds = true,
  includeMethodsHeaders = true
): Record<string, string> {
  const allowOrigin = resolveAllowedOrigin(originHeader);

  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
  };

  if (includeCreds) {
    h["Access-Control-Allow-Credentials"] = "true";
  }

  if (includeMethodsHeaders) {
    h["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
    h["Access-Control-Allow-Headers"] =
      "content-type,authorization,x-requested-with";
  }

  return h;
}

function handleOptions(
  event: APIGatewayProxyEventV2
): APIGatewayProxyStructuredResultV2 {
  const origin =
    (event.headers?.origin ??
      (event.headers as any)?.Origin) as string | undefined;

  // Manual preflight fallback if it reaches us
  return {
    statusCode: 204,
    headers: buildCorsHeaders(origin, true, true),
  };
}

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2,
  ctx: LambdaCtx
): Promise<APIGatewayProxyStructuredResultV2> => {
  // Manual preflight fallback if it reaches us
  if ((event.requestContext?.http?.method ?? "").toUpperCase() === "OPTIONS") {
    return handleOptions(event);
  }

  return awsLambdaRequestHandler({
    router: appRouter,
    createContext: createLambdaContext,

    responseMeta({ ctx: trpcCtx, errors }) {
      // The request's Origin header (case-insensitive per browsers)
      const origin =
        (event.headers?.origin ??
          (event.headers as any)?.Origin) as string | undefined;

      // Build the base CORS headers for all responses
      const baseHeaders = buildCorsHeaders(origin, true, false);

      // Collect cookies that resolvers attached to the context in Lambda mode.
      // We'll pass these back so API Gateway returns Set-Cookie headers.
      const cookieList = trpcCtx?.responseCookies ?? [];

      if (errors?.length) {
        const status = (errors[0] as any)?.data?.httpStatus ?? 500;
        return {
          status,
          headers: { ...baseHeaders },
          cookies: cookieList,
        };
      }

      return {
        headers: { ...baseHeaders },
        cookies: cookieList,
      };
    },
  })(event, ctx);
};

// AWS Lambda entrypoint
export const handler = lambdaHandler;
