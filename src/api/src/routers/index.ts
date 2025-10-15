import { router, publicProcedure, mergeRouters } from './trpc';
import { helloRouter } from './hello';
import { usersRouter } from './users';
import { s3Router } from './s3.options.router';

const coreRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
});

const routers = [coreRouter, helloRouter, usersRouter, s3Router];

export const appRouter = mergeRouters(...routers);

export type AppRouter = typeof appRouter;
export { createContext } from './trpc';
