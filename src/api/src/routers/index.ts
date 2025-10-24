// src/routers/index.ts
import { router, publicProcedure, mergeRouters } from "./trpc";

// Import your feature routers here
import { helloRouter } from "./hello";
import { s3Router } from "./s3";
import { authRouter } from "./auth";

// Core/health router
const coreRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
});

// Merge all routers
export const appRouter = mergeRouters(coreRouter, helloRouter, s3Router, authRouter);

// Export type for client
export type AppRouter = typeof appRouter;
