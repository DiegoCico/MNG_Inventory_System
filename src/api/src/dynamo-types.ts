/**
 * Teamspace metadata item
 * PK: TEAM#<teamId>
 * SK: METADATA
 * GSI_NAME: normalized lowercase team name (for GSI_TeamByName)
 */
export interface TeamEntity {
  PK: `TEAM#${string}`;
  SK: 'METADATA';
  teamId: string;
  name: string;
  normalizedName: string; // lowercase for case-insensitive uniqueness
  description?: string;
  ownerId: string; // userId of creator
  createdAt: string;
  updatedAt: string;

  // GSI — used for enforcing unique team names
  GSI_NAME: string;
}

/**
 * Team member record (forward mapping)
 * PK: TEAM#<teamId>
 * SK: MEMBER#<userId>
 * Allows listing all members in a given teamspace.
 */
export interface TeamMemberEntity {
  PK: `TEAM#${string}`;
  SK: `MEMBER#${string}`;
  teamId: string;
  userId: string;
  roleId: string; // references ROLE#<roleId>
  addedAt: string;
}

/**
 * Reverse lookup (User → Team)
 * PK: USER#<userId>
 * SK: TEAM#<teamId>
 * Allows querying all teams a user belongs to.
 */
export interface UserTeamEntity {
  PK: `USER#${string}`;
  SK: `TEAM#${string}`;
  userId: string;
  teamId: string;
  roleId: string;
  joinedAt: string;
}
