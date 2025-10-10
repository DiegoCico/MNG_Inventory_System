import { router, publicProcedure, mergeRouters } from "./trpc";
import { helloRouter } from "./hello";
import { usersRouter } from "./users";

const coreRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
});

const routers = [coreRouter, helloRouter, usersRouter];

export const appRouter = mergeRouters(...routers);

export type AppRouter = typeof appRouter;
export { createContext } from "./trpc";
