import { router, publicProcedure, mergeRouters } from './trpc';

import { helloRouter } from './hello';
import { s3Router } from './s3';
import { authRouter } from './auth';
import { teamspaceRouter } from './teamspace';
import { rolesRouter } from './roles';
import { usersRouter } from './users';
import { itemsRouter } from './items';
import { homeRouter } from './home';
import { profileRouter } from './profile';
import { exportRouter } from './export';

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
  usersRouter,
  itemsRouter,
  homeRouter,
  profileRouter,
  exportRouter,
);

export type AppRouter = typeof appRouter;
