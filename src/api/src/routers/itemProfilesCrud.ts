import { router, publicProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import {
  authFromInput,
  CreateItemProfileInput,
  UpdateItemProfileInput,
  DeleteItemProfileInput,
  IdSchema,
  AuthInput,
  itemProfilesRepo,
  makeAuditOnCreate,
  makeAuditOnUpdate,
  ensureImageObjectExists,
  buildImageKey,
} from "./itemProfilesShared";

export const itemProfilesItemRouter = router({
  create: publicProcedure
    .input(CreateItemProfileInput)
    .mutation(async ({ input }) => {
      const { userId, teamId } = authFromInput(input);
      if (input.parentItemId) {
        const parent = await itemProfilesRepo.getById(teamId, input.parentItemId);
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `parentItemId not found: ${input.parentItemId}`,
          });
        }
      }
      let constructedKey: string | undefined;
      if (input.image?.filename) {
        const hint = input.image.dirHint || input.nsn;
        constructedKey = buildImageKey(teamId, hint, input.image.filename);
      }
      const safeKey = await ensureImageObjectExists(
        teamId,
        constructedKey ?? input.imageKey
      );
      const audit = makeAuditOnCreate(userId, teamId);
      return await itemProfilesRepo.create(teamId, {
        ...input,
        imageKey: safeKey,
        ...audit,
      });
    }),

  update: publicProcedure
    .input(UpdateItemProfileInput)
    .mutation(async ({ input }) => {
      const { userId, teamId } = authFromInput(input);
      if (
        typeof input.patch.parentItemId !== "undefined" &&
        input.patch.parentItemId
      ) {
        const parent = await itemProfilesRepo.getById(
          teamId,
          input.patch.parentItemId
        );
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `parentItemId not found: ${input.patch.parentItemId}`,
          });
        }
      }
      let imageKeyPatched = input.patch.imageKey;
      if (input.patch.image) {
        const hint =
          input.patch.image.dirHint ||
          input.patch.nsn ||
          (await itemProfilesRepo.getById(teamId, input.id))?.nsn ||
          "item";
        imageKeyPatched = buildImageKey(teamId, hint, input.patch.image.filename);
      }
      if (typeof imageKeyPatched !== "undefined") {
        imageKeyPatched = await ensureImageObjectExists(teamId, imageKeyPatched);
      }
      const patch = {
        ...input.patch,
        imageKey: imageKeyPatched,
        ...makeAuditOnUpdate(userId),
      } as any;
      return await itemProfilesRepo.update(teamId, input.id, patch);
    }),

  delete: publicProcedure
    .input(DeleteItemProfileInput)
    .mutation(async ({ input }) => {
      const { teamId } = authFromInput(input);
      return input.hard
        ? await itemProfilesRepo.hardDelete(teamId, input.id)
        : await itemProfilesRepo.softDelete(teamId, input.id);
    }),

  getById: publicProcedure
    .input(AuthInput.extend({ id: IdSchema }))
    .query(async ({ input }) => {
      const { teamId } = authFromInput(input);
      const rec = await itemProfilesRepo.getById(teamId, input.id);
      if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      return rec;
    }),

  findByNSN: publicProcedure
    .input(AuthInput.extend({ nsn: IdSchema }))
    .query(async ({ input }) => {
      const { teamId } = authFromInput(input);
      const rec = await itemProfilesRepo.findByNSN(teamId, input.nsn);
      if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      return rec;
    }),
});