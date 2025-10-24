// src/server.ts

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createExpressContext } from "./routers/trpc";

/**
 * ------------------------------------------------------------------
 * Allowed origins for local dev:
 * - We MUST NOT use "*" if we want to send cookies.
 * - These should match the same list you passed into CDK
 *   (CloudFront URL + localhost dev URLs).
 * ------------------------------------------------------------------
 */
const CANONICAL_ALLOWED_ORIGINS = [
  process.env.LOCAL_WEB_ORIGIN ?? "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://d2cktegyq4qcfk.cloudfront.net",
];

/**
 * Resolve which origin to echo in Access-Control-Allow-Origin.
 * For Express/cors() we can supply a function(origin, callback)
 * to dynamically approve/deny each request.
 */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / curl cases
  return CANONICAL_ALLOWED_ORIGINS.includes(origin);
}

/**
 * Build an Express cors() config that:
 * - reflects the request Origin (if allowed),
 * - sets credentials:true so browsers can send cookies,
 * - rejects disallowed origins cleanly in dev.
 */
const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      // reflect requesting origin
      return callback(null, origin || CANONICAL_ALLOWED_ORIGINS[0]);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  allowedHeaders: [
    "content-type",
    "authorization",
    "x-requested-with",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 60 * 60 * 12, // 12h like API Gateway
});

const app = express();

/**
 * We mount CORS first so preflight OPTIONS is handled.
 * Then JSON parser, then routes.
 */
app.use(corsMiddleware);
app.use(express.json());

/**
 * Health check
 */
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send("ok");
});

/**
 * tRPC endpoint (Express adapter).
 *
 * This uses the same router and context you use in Lambda,
 * except here createExpressContext injects req/res so that
 * setAuthCookies / attachAuthCookiesToContext can directly set
 * `Set-Cookie` headers on res during local dev.
 */
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: createExpressContext,
    onError({ error, path, type }) {
      // Helpful detail in dev
      console.error(`[tRPC] ${type} ${path} failed`, {
        code: error.code,
        message: error.message,
        cause: (error.cause as any)?.message ?? error.cause,
      });
    },
  })
);

/**
 * Catch-all error handler, so local dev doesn't just hard-crash.
 * This also makes 500s show up as JSON if something escapes
 * the tRPC layer.
 */
app.use(
  (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      detail: String(err?.message ?? err),
    });
  }
);

/**
 * Start server unless we're under tests.
 */
const PORT = Number(process.env.PORT) || 3001;

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
    console.log("Allowed CORS origins:", CANONICAL_ALLOWED_ORIGINS);
  });

  server.on("error", (err: any) => {
    if (err?.code === "EADDRINUSE") {
      console.error(
        `⚠️  Port ${PORT} is already in use. Did you start another server?`
      );
      process.exit(1);
    } else {
      throw err;
    }
  });
}

export default app;
