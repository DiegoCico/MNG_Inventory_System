# API
The API folder maintains internal routing methods and their helpers.

### Current pathways
These are the currently implemented router pathways in the /API pathway.
- Index: Combines and exports all of the routers.  
- Auth: Verifies user accounts and permissions.  Uses AWS Cognito.
- Cookies: Helps users avoid having to sign in multiple times in a short timeframe by 'remembering' that they logged in. 
- S3: Handles any S3 bucket fetching; we are using S3 for image storage
- Roles: Handles roles and permissions, which are stored in DynamoDB
- Teamspace: CRUD for making teamspaces (spaces for teams).
- TRPC: Helpers for intializing TPRC routers. Documentation for tPRC can be found [here](https://trpc.io/docs/server/routers).

### Usage of current pathways
Below are the current API methods and use cases. Methods are called using: 
> caller.router_name.method_name({param_name: param, param_name: param}) 

#### Auth

| Router name          | Use case                                                          | Params |
|----------------------|-------------------------------------------------------------------|----------------------|
| inviteUser         | Invite a user via Cognito and send custom SES email with temp pw  | inviteUser({ email: "user@example.com" }) |
| signIn             | Sign in with email/password, handle challenges, set auth cookies  | signIn({ email: "user@example.com", password: "password123" })` |
| respondToChallenge | Complete NEW_PASSWORD_REQUIRED or MFA challenge and set cookies   | respondToChallenge({ challengeName: "NEW_PASSWORD_REQUIRED", session, newPassword: "betterpassword123!", email: "user@example.com" })` |
| me                 | Inspect auth cookies and return current user/session info         | me() |
| refresh            | Refresh access/id tokens using refresh cookie                     | refresh() |
| logout             | Clear auth cookies and end session                                | logout() |


#### S3

| Router name     | Use case | Params |
|-----------------|----------|-----------------------|
| s3health      | Health-check for the S3 router | s3health() |
| uploadImage   | Upload an image from a data URL; backend derives teamId + builds key | uploadImage({ scope: "item", serialNumber: "1234", dataUrl }) |
| getSignedUrl  | Return presigned HEAD URL for an object | getSignedUrl({ key }) |
| deleteObject  | Delete an S3 object by key | deleteObject({ key }) |
| listImages    | List images under a computed prefix for the team/scope/item | listImages({ scope: "item", serialNumber: "1234", limit: 50 }) |

#### Teamspace

| Router name         | Use case                                             | Params |
|---------------------|------------------------------------------------------|----------------------|
| createTeamspace   | Create a new teamspace and add caller as Owner       | createTeamspace({ name: "Logistics", description: "Ops team", userId }) |
| getTeamspace      | List all teamspaces the user belongs to              | getTeamspace({ userId }) |
| addUserTeamspace  | Add a member (by email) to a teamspace (permissioned)| addUserTeamspace({ userId, memberEmail: "new@user.com", inviteWorkspaceId: teamId }) |
| removeUserTeamspace | Remove a member (by email) from a teamspace       | removeUserTeamspace({ userId, memberEmail: "old@user.com", inviteWorkspaceId: teamId }) |
| deleteTeamspace   | Delete an entire teamspace and all its records       | deleteTeamspace({ userId, inviteWorkspaceId: teamId }) |

#### Roles

| Router name   | Use case                                             | Params |
|---------------|------------------------------------------------------|----------------------|
| createRole  | Create a new role with explicit permissions          | createRole({ name: "Manager", description: "Manages team", permissions: ["team.add_member", "workspace.create"] })` |
| getRole     | Fetch a single role by `roleId` or by `name`         | getRole({ roleId: "abc123" })` or `getRole({ name: "Owner" })` |
| updateRole  | Update role name, description, and/or permissions    | updateRole({ roleId: "abc123", name: "Lead", permissions: ["team.add_member"] })` |
| deleteRole  | Delete a role by id (no-op if role does not exist)   | deleteRole({ roleId: "abc123" })` |

### Example Usage

```ts
const caller = await createCaller({ cookies });

const ws = await createTeamspace({ name: "Ops", description: "", userId });
await uploadImage({ scope: "item", serialNumber: "123", dataUrl });
await caller.itemProfiles.create({ nsn: "1234-00-000-0000", name: "Toolkit" });
```

### Testing Example

```ts
const caller = await createCallerTest();
const { items } = await caller.itemProfiles.list({ limit: 10 });
```