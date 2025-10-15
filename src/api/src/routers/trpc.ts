import { initTRPC } from '@trpc/server';

export type Context = {};
export const createContext = async (): Promise<Context> => ({});

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const mergeRouters = t.mergeRouters;
