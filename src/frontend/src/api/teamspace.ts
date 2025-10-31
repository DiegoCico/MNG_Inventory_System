export interface Team {
  workspaceId: string;
  name: string;
  description?: string;
  roleId: string;
  permissions?: string[];
  joinedAt?: string;
}

const TRPC = "/trpc";

/* ---------------- FETCH USER TEAMS ---------------- */
export async function fetchUserTeams(): Promise<Team[]> {
  const meRes = await fetch(`${TRPC}/me?input=${encodeURIComponent("null")}`, {
    method: "GET",
    credentials: "include",
  });
  const meJson = await meRes.json();
  const userId = meJson?.result?.data?.userId || meJson?.result?.data?.email;
  if (!userId) throw new Error("User not authenticated");

  const res = await fetch(`${TRPC}/getUserWorkspaces`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { userId } }),
  });

  const json = await res.json();
  if (!json?.result?.data?.workspaces) {
    throw new Error("Failed to fetch user workspaces");
  }

  return json.result.data.workspaces;
}

/* ---------------- CREATE WORKSPACE ---------------- */
export async function createWorkspace(
  userId: string,
  name: string,
  description?: string
) {
  const res = await fetch(`${TRPC}/createWorkspace`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { userId, name, description },
    }),
  });

  const json = await res.json();
  if (!json?.result?.data?.workspace)
    throw new Error("Failed to create workspace");
  return json.result.data.workspace;
}

/* ---------------- ADD MEMBER (Invite) ---------------- */
export async function addMemberToWorkspace(
  userId: string,
  workspaceId: string,
  newMemberId: string,
  roleId: string = "member"
) {
  const res = await fetch(`${TRPC}/addMember`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { userId, workspaceId, newMemberId, roleId },
    }),
  });

  const json = await res.json();
  if (!json?.result?.data?.success)
    throw new Error("Failed to add member");
  return json.result.data;
}

/* ---------------- REMOVE MEMBER ---------------- */
export async function removeMemberFromWorkspace(
  userId: string,
  workspaceId: string,
  memberId: string
) {
  const res = await fetch(`${TRPC}/removeMember`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { userId, workspaceId, memberId },
    }),
  });

  const json = await res.json();
  if (!json?.result?.data?.success)
    throw new Error("Failed to remove member");
  return json.result.data;
}

/* ---------------- DELETE WORKSPACE ---------------- */
export async function deleteWorkspace(userId: string, workspaceId: string) {
  const res = await fetch(`${TRPC}/deleteWorkspace`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { userId, workspaceId },
    }),
  });

  const json = await res.json();
  if (!json?.result?.data?.success)
    throw new Error("Failed to delete workspace");
  return json.result.data;
}
