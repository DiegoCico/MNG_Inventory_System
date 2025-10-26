
// modify to match dynamo schema

export interface WorkspaceEntity {
  PK: `WORKSPACE#${string}`;
  SK: "METADATA";
  workspaceId: string;
  name: string;
  description?: string;
  ownerId: string; // userId of creator
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberEntity {
  PK: `WORKSPACE#${string}`;
  SK: `MEMBER#${string}`; // MEMBER#<userId>
  workspaceId: string;
  userId: string;
  roleId: string; // references ROLE#<roleId>
  addedAt: string;
}

export interface UserWorkspaceEntity {
  PK: `USER#${string}`;
  SK: `WORKSPACE#${string}`; // allows querying "all workspaces for this user"
  userId: string;
  workspaceId: string;
  roleId: string;
  joinedAt: string;
}