import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";
import { doc } from "../aws";

const TABLE_NAME = process.env.DDB_TABLE_NAME || "mng-dev-data";

function newId(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString("base64")
    .replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c] as string));
}

/** Check if a user has a permission inside a specific teamspace */
async function hasPermission(
  userId: string,
  teamId: string,
  permission: string
): Promise<boolean> {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TEAM#${teamId}`, SK: `MEMBER#${userId}` },
    })
  );
  const member = res.Item as { role?: string } | undefined;
  if (!member) return false;

  const roleRes = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `ROLENAME#${member.role?.toLowerCase()}`,
        SK: `ROLE#${member.role?.toUpperCase()}`,
      },
    })
  );
  const role = roleRes.Item as { permissions?: string } | undefined;
  if (!role) return false;

  const perms: string[] = JSON.parse(role.permissions ?? "[]");
  return perms.includes(permission);
}

export const teamspaceRouter = router({
  /** ---------------------------------------------------------------
   *  createTeamspace
   *  ---------------------------------------------------------------
   *  input: { name, description?, userId }
   *  Creates a unique team and assigns creator as Owner
   */
  createTeamspace: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(60),
        description: z.string().max(280).optional(),
        userId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const cleanName = input.name.trim().toLowerCase();
      const now = new Date().toISOString();

      const dup = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI_WorkspaceByName",
          KeyConditionExpression: "GSI_NAME = :n",
          ExpressionAttributeValues: { ":n": cleanName },
          Limit: 1,
        })
      );
      if (dup.Items && dup.Items.length > 0)
        throw new Error("A team with this name already exists.");

      const teamId = newId(12);

      const teamItem = {
        PK: `TEAM#${teamId}`,
        SK: "METADATA",
        Type: "Team",
        teamId,
        name: input.name,
        description: input.description ?? "",
        ownerId: input.userId,
        createdAt: now,
        updatedAt: now,
        GSI_NAME: cleanName,
      };

      const memberItem = {
        PK: `TEAM#${teamId}`,
        SK: `MEMBER#${input.userId}`,
        Type: "TeamMember",
        teamId,
        userId: input.userId,
        role: "Owner",
        joinedAt: now,
        GSI1PK: `USER#${input.userId}`,
        GSI1SK: `TEAM#${teamId}`,
      };

      await Promise.all([
        doc.send(new PutCommand({ TableName: TABLE_NAME, Item: teamItem })),
        doc.send(new PutCommand({ TableName: TABLE_NAME, Item: memberItem })),
      ]);

      return { success: true, teamId, name: input.name };
    }),

  /** ---------------------------------------------------------------
   *  getTeamspace
   *  ---------------------------------------------------------------
   *  input: { userId }
   *  Returns all teamspaces the user belongs to
   */
  getTeamspace: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      const q = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI_UserTeams",
          KeyConditionExpression: "GSI1PK = :uid",
          ExpressionAttributeValues: { ":uid": `USER#${input.userId}` },
        })
      );

      const memberships = q.Items ?? [];
      if (!memberships.length) return { teams: [] };

      const teams = await Promise.all(
        memberships.map(async (m) => {
          const res = await doc.send(
            new GetCommand({
              TableName: TABLE_NAME,
              Key: { PK: `TEAM#${m.teamId}`, SK: "METADATA" },
            })
          );
          return res.Item;
        })
      );

      return { teams };
    }),

  /** ---------------------------------------------------------------
   *  addUserTeamspace
   *  ---------------------------------------------------------------
   *  input: { userId, userEmail, teamspaceId }
   *  Adds another user to a team (requires team.add_member)
   */
  addUserTeamspace: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        userEmail: z
          .string()
          .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"),
        teamspaceId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const allowed = await hasPermission(
        input.userId,
        input.teamspaceId,
        "team.add_member"
      );
      if (!allowed) throw new Error("Not authorized to add members.");

      const q = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI_UsersByUid",
          KeyConditionExpression: "email = :e",
          ExpressionAttributeValues: { ":e": input.userEmail },
        })
      );

      const user = q.Items?.[0];
      if (!user) throw new Error("Target user not found.");

      const now = new Date().toISOString();
      const member = {
        PK: `TEAM#${input.teamspaceId}`,
        SK: `MEMBER#${user.accountId}`,
        Type: "TeamMember",
        teamId: input.teamspaceId,
        userId: user.accountId,
        role: "Member",
        joinedAt: now,
        GSI1PK: `USER#${user.accountId}`,
        GSI1SK: `TEAM#${input.teamspaceId}`,
      };

      await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: member }));
      return { success: true, added: user.email };
    }),

  /** ---------------------------------------------------------------
   *  removeUserTeamspace
   *  ---------------------------------------------------------------
   *  input: { userId, userEmail, teamspaceId }
   *  Removes a user (requires team.remove_member)
   */
  removeUserTeamspace: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        userEmail: z
          .string()
          .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"),
        teamspaceId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const allowed = await hasPermission(
        input.userId,
        input.teamspaceId,
        "team.remove_member"
      );
      if (!allowed) throw new Error("Not authorized to remove members.");

      const q = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI_UsersByUid",
          KeyConditionExpression: "email = :e",
          ExpressionAttributeValues: { ":e": input.userEmail },
        })
      );
      const target = q.Items?.[0];
      if (!target) throw new Error("User not found.");

      await doc.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `TEAM#${input.teamspaceId}`,
            SK: `MEMBER#${target.accountId}`,
          },
        })
      );

      return { success: true, removed: target.email };
    }),

  /** ---------------------------------------------------------------
   *  deleteTeamspace
   *  ---------------------------------------------------------------
   *  input: { teamspaceId, userId }
   *  Deletes an entire team (requires workspace.delete)
   */
  deleteTeamspace: publicProcedure
    .input(
      z.object({
        teamspaceId: z.string().min(1),
        userId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const allowed = await hasPermission(
        input.userId,
        input.teamspaceId,
        "workspace.delete"
      );
      if (!allowed) throw new Error("Not authorized to delete team.");

      const q = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": `TEAM#${input.teamspaceId}` },
        })
      );

      const items = q.Items ?? [];
      await Promise.all(
        items.map((it) =>
          doc.send(
            new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { PK: it.PK, SK: it.SK },
            })
          )
        )
      );

      return { success: true, deleted: input.teamspaceId };
    }),
});
