import { router, publicProcedure } from './trpc';

// TEST CASE
export const usersRouter = router({
  me: publicProcedure.query(() => ({ id: 'u_123', email: 'me@example.com' })),
});
