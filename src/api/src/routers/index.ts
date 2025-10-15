import { router, publicProcedure } from './trpc';
import { helloRouter } from './hello';
import { usersRouter } from './users';
import { s3Router } from './s3';
import { authRouter } from './auth';

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
  hello: helloRouter,
  users: usersRouter,
  s3: s3Router,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
export { createContext } from './trpc';
