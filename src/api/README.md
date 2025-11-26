# API

The API folder maintains internal routing methods and their helpers.

### Current pathways

These are the currently implemented router pathways in the /API pathway.

- Index: Combines and exports all of the routers.
- Auth: Verifies user accounts and permissions. Uses AWS Cognito.
- Cookies: Helps users avoid having to sign in multiple times in a short timeframe by 'remembering' that they logged in.
- S3: Handles any S3 bucket fetching; we are using S3 for image storage
- Roles: Handles roles and permissions, which are stored in DynamoDB
- Teamspace: CRUD for making teamspaces (spaces for teams).
- Items: CRUD for item profiles and inventory-related records.
- Home: Returns top-level system summaries and simple status information.
- Process: Handles long-running or multi-step backend processes.
- TRPC: Helpers for intializing TPRC routers. Documentation for tPRC can be found [here](https://trpc.io/docs/server/routers).

### Usage of current pathways

Below are the current API methods and use cases. Methods are called using:

> caller.router_name.method_name({param_name: param, param_name: param})

#### Auth

| Router name        | Use case                                                         | Params                                                                                    | Returns                                                                                           |                                    |          |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- | -------- |
| inviteUser         | Invite a user via Cognito and send custom SES email with temp pw | inviteUser({ email: "[user@example.com](mailto:user@example.com)" })                      | `{ success: true, userEmail, message }`                                                           |                                    |          |
| signIn             | Sign in with email/password, handle challenges, set cookies      | signIn({ email: "[user@example.com](mailto:user@example.com)", password: "password123" }) | Challenge → `{ success: false, challengeName, session }`<br>Success → `{ success: true, tokens }` |                                    |          |
| respondToChallenge | Complete NEW_PASSWORD_REQUIRED or MFA challenge                  | respondToChallenge({ challengeName, session, newPassword?, mfaCode?, email })             | Challenge → `{ success: false, challengeName, session }`<br>Success → `{ success: true, tokens }` |                                    |          |
| me                 | Inspect auth cookies and return current user info                | me()                                                                                      | `{ authenticated: false }` or `{ authenticated: true, userId, username, role, accountId }`        |                                    |          |
| refresh            | Refresh access/id tokens using refresh cookie                    | refresh()                                                                                 | `{ refreshed: false }` or `{ refreshed: true, userId, username, accountId }`                      |                                    |          |
| logout             | Clear auth cookies and end session                               | logout()                                                                                  | `{ success: true, message: "Signed out" }`                                                        | 

#### S3

| Router name  | Use case                                                             | Params                                        | Returns                             |
| ------------ | -------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------- |
| s3health     | Health-check for the S3 router                                       | s3health()                                    | `{ ok: true }`                      |
| uploadImage  | Upload an image from a data URL; backend derives teamId + builds key | uploadImage({ scope, serialNumber, dataUrl }) | `{ key, url }`                      |
| getSignedUrl | Return presigned HEAD/GET URL for an object                          | getSignedUrl({ key })                         | `{ exists: boolean, url?: string }` |
| deleteObject | Delete an S3 object by key                                           | deleteObject({ key })                         | `{ success: true }`                 |
| listImages   | List images under a computed prefix for the team/scope/item          | listImages({ scope, serialNumber, limit })    | `{ images: string[] }`              |

#### Teamspace 

| Router name             | Use case                                          | Params                                                               | Returns                               |
| ----------------------- | ------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------- |
| **createTeamspace**     | Create a new teamspace and add caller as Owner    | `createTeamspace({ name, description, uic, fe, userId })`            | `{ success, teamId?, name?, error? }` |
| **getTeamspace**        | List all teamspaces the user belongs to           | `getTeamspace({ userId })`                                           | `{ success, teams?, error? }`         |
| **getTeamById**         | Fetch a single team by id (must be a member)      | `getTeamById({ teamId, userId })`                                    | `{ success, team?, error? }`          |
| **addUserTeamspace**    | Add a member to a teamspace by username           | `addUserTeamspace({ userId, memberUsername, inviteWorkspaceId })`    | `{ success, added?, error? }`         |
| **removeUserTeamspace** | Remove a member from a teamspace                  | `removeUserTeamspace({ userId, memberUsername, inviteWorkspaceId })` | `{ success, removed?, error? }`       |
| **deleteTeamspace**     | Delete a workspace and related records (DDB + S3) | `deleteTeamspace({ userId, inviteWorkspaceId })`                     | `{ success, deleted?, error? }`       |
| **getAllUsers**         | Fetch all users + their team memberships          | `getAllUsers()`                                                      | `{ success, users?, error? }`         |
| **getTeamMembers**      | Fetch all members of a specific teamspace         | `getTeamMembers({ teamId })`                                         | `{ success, members?, error? }`       |

#### Users

| Router name            | Use case                                    | Params                             | Returns                                             |
| ---------------------- | ------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| **listUsersWithRoles** | List all users with their global roles      | `listUsersWithRoles()`             | `{ users: [{ userId, username, name, roleName }] }` |
| **assignRole**         | Assign a global role to a user              | `assignRole({ userId, roleName })` | `{ success, roleName }`                             |
| **getUserRole**        | Fetch a user's global role                  | `getUserRole({ userId })`          | `{ userId, roleName }`                              |
| **deleteUser**         | Delete a user + profile image + memberships | `deleteUser({ userId })`           | `{ success: true }`                                 |

#### Roles

| Router name     | Use case                            | Params                                             | Returns                                  |
| --------------- | ----------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| **createRole**  | Create a new custom role            | `createRole({ name, description?, permissions })`  | `{ success: boolean, role?, error? }`    |
| **getAllRoles** | Fetch all roles                     | `getAllRoles()`                                    | `{ roles: RoleEntity[] }`                |
| **getRole**     | Fetch a single role by id or name   | `getRole({ roleId?, name? })`                      | `{ role }` or error                      |
| **updateRole**  | Modify an existing non-default role | `updateRole({ name, description?, permissions? })` | `{ success: boolean, role?, error? }`    |
| **deleteRole**  | Delete a non-default role           | `deleteRole({ name })`                             | `{ success: boolean, deleted: boolean }` |

#### Items

| Router name     | Use case                                 | Params                                           | Returns                               |
| --------------- | ---------------------------------------- | ------------------------------------------------ | ------------------------------------- |
| **createItem**  | Create a new item or kit                 | `createItem({ teamId, name, nsn, userId, ... })` | `{ success, itemId?, item?, error? }` |
| **getItems**    | Fetch all items for a team               | `getItems({ teamId, userId })`                   | `{ success, items?, error? }`         |
| **getItem**     | Fetch one item by ID                     | `getItem({ teamId, itemId, userId })`            | `{ success, item?, error? }`          |
| **updateItem**  | Update fields, status, image, kit fields | `updateItem({ teamId, itemId, userId, ... })`    | `{ success, item?, error? }`          |
| **deleteItem**  | Delete an item + its S3 image            | `deleteItem({ teamId, itemId, userId })`         | `{ success, message?, error? }`       |
| **uploadImage** | Upload or replace an image for an item   | `uploadImage({ teamId, nsn, imageBase64 })`      | `{ success, imageKey?, error? }`      |

#### Resets

| Router name   | Use case                                 | Params                  | Returns                                               |
| ------------- | ---------------------------------------- | ----------------------- | ----------------------------------------------------- |
| **hardReset** | Delete all items + S3 images for a team  | `hardReset({ teamId })` | `{ success, message }` or `{ success: false, error }` |
| **softReset** | Mark all items as `To Review` for a team | `softReset({ teamId })` | `{ success, message }` or `{ success: false, error }` |

#### Export

| Router name   | Use case                                                           | Params                  | Returns                                        |
| ------------- | ------------------------------------------------------------------ | ----------------------- | ---------------------------------------------- |
| **getExport** | Run Python export scripts (2404 + inventory) and return CSV output | `getExport({ teamId })` | `{ success, csv2404?, csvInventory?, error? }` |


#### Process

The Process router coordinates operations that take longer than a normal request. These workflows may run in multiple stages, write intermediate state, and need to be polled by the client. The router lets you start a job, check its progress, and cancel it if the user has permission.

When the backend loads its configuration, the console prints a summary containing:

| Field        | Meaning                              |
| ------------ | ------------------------------------ |
| Stage        | Deployment stage (DEV / BETA / PROD) |
| Region       | AWS region being used                |
| Table        | DynamoDB table name                  |
| Bucket       | S3 uploads bucket                    |
| Cognito Pool | User pool ID or "none"               |
| SES From     | Email used for outgoing messages     |
| Web URL      | Public-facing web client URL         |

---

### Example Usage

```ts
const caller = await createCaller({ cookies });

const ws = await createTeamspace({ name: 'Ops', description: '', userId });
await uploadImage({ scope: 'item', serialNumber: '123', dataUrl });
await caller.itemProfiles.create({ nsn: '1234-00-000-0000', name: 'Toolkit' });
```

### Testing Example

```ts
const caller = await createCallerTest();
const { items } = await caller.itemProfiles.list({ limit: 10 });
```
