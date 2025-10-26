import { success, z } from 'zod';
import { router, publicProcedure } from './trpc';
import { getItemsByParent, getUserByUid } from '../helpers/workspaceHelpers';

export const workspaceRouter = router({
  getUserByUid: publicProcedure
    .input(
      z.object({
        uid: z.string().min(1, 'UID is required'),
      }),
    )
    .query(async ({ input }) => {
      try {
        const user = await getUserByUid({ uid: input.uid });

        if (!user) {
          throw new Error('User not found');
        }

        return {
          success: true,
          user,
        };
      } catch (error: any) {
        console.error('Error in getUserByUid: ', error);
        throw new Error(error.message || 'Failed to get user');
      }
    }),
  getItemsByParent: publicProcedure
    .input(
      z.object({
        parentItemId: z.string().min(1, 'Parent item ID is required'),
      }),
    )
    .query(async ({ input }) => {
      try {
        const items = await getItemsByParent({
          parentItemId: input.parentItemId,
        });

        return {
          success: true,
          items,
        };
      } catch (error: any) {
        console.error('Error in getItemsByParent: ', error);
        throw new Error(error.message || 'Failed to get child items');
      }
    }),
});
