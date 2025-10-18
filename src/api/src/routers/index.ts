import { router, publicProcedure, mergeRouters } from "./trpc";
import { helloRouter } from "./hello";
import { s3Router } from "./s3";
import { authRouter } from "./auth";

const coreRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
});

const featureRouters = [
  helloRouter,
  s3Router,
  authRouter,
] as const;

export const appRouter = mergeRouters(coreRouter, ...featureRouters);

export type AppRouter = typeof appRouter;
export { createContext } from "./trpc";
