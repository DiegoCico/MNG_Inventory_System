import { router, publicProcedure } from "../trpc";

export const appRouter = router({
  hello: publicProcedure.query(() => ({ message: "Hello from tRPC API!" })),
});

export type AppRouter = typeof appRouter;