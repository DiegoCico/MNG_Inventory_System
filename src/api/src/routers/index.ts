import { router, publicProcedure, mergeRouters } from './trpc';

import { helloRouter } from './hello';
import { s3Router } from './s3';
import { authRouter } from './auth';
import { teamspaceRouter } from './teamspace';
import { rolesRouter } from './roles';
import { itemsRouter } from './items';
import { homeRouter } from './home';
import { profileRouter } from './profile';

const coreRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
});

export const appRouter = mergeRouters(
  coreRouter,
  helloRouter,
  s3Router,
  authRouter,
  teamspaceRouter,
  rolesRouter,
  itemsRouter,
  homeRouter,
  profileRouter,
);

export type AppRouter = typeof appRouter;
