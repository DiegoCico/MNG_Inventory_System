/**
 * Item Profiles Router (Aggregator)
 * ----------------------------------------------------------------------------
 * Split for readability:
 *   - itemProfiles.item.ts   → create / update / delete / getById / findByNSN
 *   - itemProfiles.list.ts   → list with filters, pagination, ordering
 *
 * This file merges their procedures so callers still use
 *   appRouter.itemProfiles.<procedure>
 */
import { router } from "./trpc";
import { itemProfilesItemRouter } from "./itemProfilesCrud";
import { itemProfilesListRouter } from "./itemProfilesList";

export const itemProfilesRouter = router({
  ...itemProfilesItemRouter._def.procedures,
  ...itemProfilesListRouter._def.procedures,
});

export type ItemProfilesRouter = typeof itemProfilesRouter;