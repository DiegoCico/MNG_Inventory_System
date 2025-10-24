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

  if (!originHeader) return allow[0] ?? "";
  if (allow.length === 0) return originHeader;
  if (allow.includes(originHeader)) return originHeader;
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
    h["Access-Control-Allow-Methods"] =
      "GET,POST,PUT,PATCH,DELETE,OPTIONS";
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

  return {
    statusCode: 204,
    headers: buildCorsHeaders(origin, true, true),
  };
}

export const lambdaHandler = async (
  event: APIGatewayProxyEventV2,
  ctx: LambdaCtx
): Promise<APIGatewayProxyStructuredResultV2> => {
  if ((event.requestContext?.http?.method ?? "").toUpperCase() === "OPTIONS") {
    return handleOptions(event);
  }

  const contextForThisRequest = await createLambdaContext({
    event,
    context: ctx,
  });

  return awsLambdaRequestHandler({
    router: appRouter,
    createContext: () => contextForThisRequest,

    responseMeta({ ctx: trpcCtx, errors }) {
      const origin =
        (event.headers?.origin ??
          (event.headers as any)?.Origin) as string | undefined;

      const baseHeaders = buildCorsHeaders(origin, true, false);

      // cookies captured by resolvers (authRouter) in ctx.responseCookies
      const cookieList = trpcCtx?.responseCookies ?? [];

      const mergedHeaders: Record<string, string | string[]> = {
        ...baseHeaders,
      };

      if (cookieList.length > 0) {
        mergedHeaders["Set-Cookie"] = cookieList;
      }

      if (errors?.length) {
        const status = (errors[0] as any)?.data?.httpStatus ?? 500;
        return {
          status,
          headers: mergedHeaders,
        };
      }

      return {
        headers: mergedHeaders,
      };
    },
  })(event, ctx);
};

export const handler = lambdaHandler;
