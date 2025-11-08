import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { parseCookiesFromCtx, COOKIE_ACCESS } from "../helpers/cookies";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { loadConfig } from "../process";
import { doc } from "../aws";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

const verifier = CognitoJwtVerifier.create({
  userPoolId: config.COGNITO_USER_POOL_ID,
  clientId: config.COGNITO_CLIENT_ID,
  tokenUse: "access",
});

export const profileRouter = router({
  getProfile: publicProcedure.query(async ({ ctx }) => {
    const cookies = parseCookiesFromCtx(ctx);
    const token = cookies[COOKIE_ACCESS];
    if (!token) return { authenticated: false, message: "No session" };

    try {
      const decoded = await verifier.verify(token);
      const userId = decoded.sub;
      const email =
        decoded.email ||
        decoded["cognito:username"] ||
        `${userId}@example.com`;

      console.log("🔹 [Profile] Fetching user:", userId);

      // ---- GET USER RECORD (alias 'name') ----
      const userRes = await doc.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: "METADATA" },
          ProjectionExpression: "#nm, email, role",
          ExpressionAttributeNames: { "#nm": "name" },
          ConsistentRead: true,
        })
      );

      let user = userRes.Item;

      // ---- CREATE IF MISSING ----
      if (!user) {
        console.log("⚠️ No user record found, creating default...");
        const now = new Date().toISOString();

        const nameFromEmail =
          typeof email === "string" && email.includes("@")
            ? email.split("@")[0]
            : "User";

        user = {
          PK: `USER#${userId}`,
          SK: "METADATA",
          sub: userId,
          email,
          name: nameFromEmail,
          role: "User",
          createdAt: now,
          updatedAt: now,
          GSI6PK: `UID#${userId}`,
          GSI6SK: `USER#${userId}`,
        };

        await doc.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: user,
          })
        );

        console.log("✅ Created new user record:", email);
      }

      // ---- TEAM LOOKUP ----
      const teamRes = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI_MembersByUser",
          KeyConditionExpression: "GSI3PK = :pk",
          ExpressionAttributeValues: {
            ":pk": `USER#${userId}`,
          },
          Limit: 1,
        })
      );

      const teamItem = teamRes.Items?.[0];
      const teamName = teamItem?.teamName ?? "No Team Assigned";

      console.log("📘 [Profile] Returning:", {
        name: user.name,
        role: user.role,
        team: teamName,
      });

      return {
        authenticated: true,
        userId,
        name: user.name,
        email: user.email,
        team: teamName,
        role: user.role ?? "User",
      };
    } catch (err) {
      console.error("❌ [Profile] getProfile error:", err);
      return { authenticated: false, message: "Invalid or expired session" };
    }
  }),
  updateProfile: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().optional(),
        role: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log("🟡 [Profile] updateProfile input:", input);

        // 1️⃣ Ensure user exists
        const existing = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${input.userId}`, SK: "METADATA" },
            ConsistentRead: true,
          })
        );

        if (!existing.Item) {
          console.log("⚠️ Creating base user record...");
          const now = new Date().toISOString();
          const defaultEmail = `${input.userId}@example.com`;
          const defaultName = defaultEmail.split("@")[0];
          await doc.send(
            new PutCommand({
              TableName: TABLE_NAME,
              Item: {
                PK: `USER#${input.userId}`,
                SK: "METADATA",
                sub: input.userId,
                email: defaultEmail,
                name: defaultName,
                role: "User",
                createdAt: now,
                updatedAt: now,
                GSI6PK: `UID#${input.userId}`,
                GSI6SK: `USER#${input.userId}`,
              },
            })
          );
        }

        // Prepare update expression with aliases
        const updates: string[] = [];
        const values: Record<string, any> = {
          ":updatedAt": new Date().toISOString(),
        };
        const names: Record<string, string> = {
          "#nm": "name",
          "#rl": "role",
        };

        if (input.name?.trim()) {
          updates.push("#nm = :name");
          values[":name"] = input.name.trim();
        }

        if (input.role?.trim()) {
          updates.push("#rl = :role");
          values[":role"] = input.role.trim();
        }

        updates.push("updatedAt = :updatedAt");
        const updateExpr = `SET ${updates.join(", ")}`;

        //  Execute update
        await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${input.userId}`, SK: "METADATA" },
            UpdateExpression: updateExpr,
            ExpressionAttributeValues: values,
            ExpressionAttributeNames: names,
          })
        );

        console.log(`✅ [Profile] Updated user ${input.userId}`);
        return { success: true, message: "Profile updated successfully" };
      } catch (err) {
        console.error("❌ [Profile] updateProfile error:", err);
        return { success: false, message: "Failed to update profile" };
      }
    }),
});
