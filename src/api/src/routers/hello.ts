import { z } from 'zod';
import { router, publicProcedure } from './trpc';

export const helloRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }).nullish())
    .query(({ input }) => {
      const name = input?.name ?? 'world';
      return { message: `Hello ${name}` };
    }),
});
