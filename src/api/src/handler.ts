import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context as LambdaCtx,
} from "aws-lambda";
import { appRouter } from "./routers";
import { createLambdaContext } from "./routers/trpc";

/**
 * Pick which Origin we will echo back in CORS.
 * We prefer a whitelist from process.env.ALLOWED_ORIGINS.
 * If there's no whitelist, we fall back to the request Origin.
 */
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

/**
 * Build the CORS headers we want the browser to see.
 * IMPORTANT:
 * - Access-Control-Allow-Credentials: true so browser can send/receive cookies.
 * - Access-Control-Allow-Origin MUST be a specific origin, not "*".
 */
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

/**
 * Handle preflight OPTIONS if API Gateway forwards it through to Lambda.
 * (API Gateway may answer OPTIONS itself, but if it doesn't, we do it here.)
 */
function handleOptions(
  event: APIGatewayProxyEventV2
): APIGatewayProxyStructuredResultV2 {
  const origin =
    (event.headers?.origin ??
      (event.headers as any)?.Origin) as string | undefined;

  return {
    statusCode: 204,
    headers: buildCorsHeaders(origin, true, true),
  };
}

/**
 * Main Lambda handler around tRPC.
 *
 * - Always attach CORS headers.
 * - Surface any cookies collected in ctx.responseCookies via responseMeta.
 *   The awsLambdaRequestHandler will map `cookies: string[]` to multiple
 *   Set-Cookie headers in the final API Gateway response.
 */
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
          headers: {
            ...baseHeaders,
          },
          cookies: cookieList,
        };
      }

      return {
        headers: {
          ...baseHeaders,
        },
        cookies: cookieList,
      };
    },
  })(event, ctx);
};

// AWS Lambda entrypoint
export const handler = lambdaHandler;
