import { router, publicProcedure } from "./trpc";
import {
  ListItemProfilesInput,
  authFromInput,
  itemProfilesRepo,
} from "./itemProfilesShared";

export const itemProfilesListRouter = router({
  list: publicProcedure
    .input(ListItemProfilesInput)
    .query(async ({ input }) => {
      const { teamId } = authFromInput(input);
      return await itemProfilesRepo.list(teamId, input);
    }),
});