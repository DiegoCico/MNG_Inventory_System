import { z } from 'zod';
import { router, protectedProcedure } from './trpc';

export const helloRouter = router({
  hello: protectedProcedure
    .input(z.object({ name: z.string().optional() }).nullish())
    .query(({ input }) => {
      const name = input?.name ?? 'world';
      return { message: `Hello ${name}` };
    }),
});
