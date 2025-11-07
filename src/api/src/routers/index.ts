import { router, publicProcedure } from "./trpc";

import { helloRouter } from "./hello";
import { s3Router } from "./s3";
// import { authRouter } from "./auth";  // COMMENTED OUT - crashes
import { teamspaceRouter } from "./teamspace";
import { rolesRouter } from "./roles";
import { itemsRouter } from "./items";
import { homeRouter } from "./home";

export const appRouter = router({
  hello: helloRouter,
  s3: s3Router,
  // auth: authRouter,  // COMMENTED OUT
  teamspace: teamspaceRouter,
  roles: rolesRouter,
  items: itemsRouter,  // This creates /trpc/items.createItem paths
  home: homeRouter,

  health: publicProcedure.query(() => ({ ok: true })),
});

export type AppRouter = typeof appRouter;
