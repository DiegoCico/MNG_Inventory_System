import { initTRPC } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';

export type Context = {
  req: Request;
  res: Response;
};

export const createContext = ({ req, res }: trpcExpress.CreateExpressContextOptions): Context => ({
  req,
  res,
});

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;
