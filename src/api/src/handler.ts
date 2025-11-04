import { awsLambdaRequestHandler } from '@trpc/server/adapters/aws-lambda';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context as LambdaCtx,
} from 'aws-lambda';
import { appRouter } from './routers';
import { createLambdaContext } from './routers/trpc';

function resolveAllowedOrigin(originHeader: string | undefined): string {
  const allow = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // no origin header? use first allowed if present
  if (!originHeader) return allow[0] ?? '';

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
  includeMethodsHeaders = true,
): Record<string, string> {
  const allowOrigin = resolveAllowedOrigin(originHeader);

  const h: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    Vary: 'Origin',
  };

  if (includeCreds) {
    h['Access-Control-Allow-Credentials'] = 'true';
  }

  if (includeMethodsHeaders) {
    h['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
    h['Access-Control-Allow-Headers'] = 'content-type,authorization,x-requested-with';
  }

  return h;
}

function handleOptions(event: APIGatewayProxyEventV2): APIGatewayProxyStructuredResultV2 {
  const origin = (event.headers?.origin ?? (event.headers as any)?.Origin) as string | undefined;

  // Manual preflight fallback if it reaches us
  return {
    statusCode: 204,
    headers: buildCorsHeaders(origin, true, true),
  };
}

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2,
  ctx: LambdaCtx,
): Promise<APIGatewayProxyStructuredResultV2> => {
  // Manual preflight fallback if it reaches us
  if ((event.requestContext?.http?.method ?? '').toUpperCase() === 'OPTIONS') {
    return handleOptions(event);
  }

  return awsLambdaRequestHandler({
    router: appRouter,
    createContext: createLambdaContext,

    responseMeta({ ctx: trpcCtx, errors }) {
      const origin = (event.headers?.origin ?? (event.headers as any)?.Origin) as
        | string
        | undefined;

      const baseHeaders = buildCorsHeaders(origin, true, false);

      // Collect cookies from tRPC context (set by auth resolvers via emitCookiesToLambda)
      const cookieList = trpcCtx?.responseCookies ?? [];

      /**
       * Cookie Fix for API Gateway HTTP API v2:
       *
       * The tRPC AWS Lambda adapter's `cookies` array return field doesn't work properly
       * with API Gateway HTTP API v2. Instead, we need to add cookies directly to the
       * headers as 'Set-Cookie'.
       *
       * By setting `Set-Cookie` to an array of cookie strings, API Gateway will properly
       * return multiple Set-Cookie headers in the response (one per cookie).
       */
      const headersWithCookies: Record<string, string | string[]> = { ...baseHeaders };

      if (cookieList.length > 0) {
        headersWithCookies['Set-Cookie'] = cookieList;
      }

      if (errors?.length) {
        const status = (errors[0] as any)?.data?.httpStatus ?? 500;
        return {
          status,
          headers: headersWithCookies,
        };
      }

      return {
        headers: headersWithCookies,
      };
    },
  })(event, ctx);
};

// AWS Lambda entrypoint
export const handler = lambdaHandler;
