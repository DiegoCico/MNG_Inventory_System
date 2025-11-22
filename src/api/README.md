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

| Router name        | Use case                                                         | Params                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| inviteUser         | Invite a user via Cognito and send custom SES email with temp pw | inviteUser({ email: "user@example.com" })                                                                                              |
| signIn             | Sign in with email/password, handle challenges, set auth cookies | signIn({ email: "user@example.com", password: "password123" })`                                                                        |
| respondToChallenge | Complete NEW_PASSWORD_REQUIRED or MFA challenge and set cookies  | respondToChallenge({ challengeName: "NEW_PASSWORD_REQUIRED", session, newPassword: "betterpassword123!", email: "user@example.com" })` |
| me                 | Inspect auth cookies and return current user/session info        | me()                                                                                                                                   |
| refresh            | Refresh access/id tokens using refresh cookie                    | refresh()                                                                                                                              |
| logout             | Clear auth cookies and end session                               | logout()                                                                                                                               |

#### S3

| Router name  | Use case                                                             | Params                                                         |
| ------------ | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| s3health     | Health-check for the S3 router                                       | s3health()                                                     |
| uploadImage  | Upload an image from a data URL; backend derives teamId + builds key | uploadImage({ scope: "item", serialNumber: "1234", dataUrl })  |
| getSignedUrl | Return presigned HEAD URL for an object                              | getSignedUrl({ key })                                          |
| deleteObject | Delete an S3 object by key                                           | deleteObject({ key })                                          |
| listImages   | List images under a computed prefix for the team/scope/item          | listImages({ scope: "item", serialNumber: "1234", limit: 50 }) |

# Teamspace

| Router name             | Use case                                             | Params                                                               |
| ----------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| **createTeamspace**     | Create a new teamspace and add caller as Owner       | `createTeamspace({ name, description, userId })`                     |
| **getTeamspace**        | List all teamspaces the user belongs to              | `getTeamspace({ userId })`                                           |
| **addUserTeamspace**    | Add a member to a teamspace using their **username** | `addUserTeamspace({ userId, memberUsername, inviteWorkspaceId })`    |
| **removeUserTeamspace** | Remove a member from a teamspace (permissioned)      | `removeUserTeamspace({ userId, memberUsername, inviteWorkspaceId })` |
| **deleteTeamspace**     | Delete an entire teamspace and all related records   | `deleteTeamspace({ userId, inviteWorkspaceId })`                     |
| **getAllUsers**         | Fetch all users for dynamic username search          | `getAllUsers()`                                                      |

#### Roles

| Router name | Use case                                           | Params                                                                                                         |
| ----------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| createRole  | Create a new role with explicit permissions        | createRole({ name: "Manager", description: "Manages team", permissions: ["team.add_member", "team.create"] })` |
| getRole     | Fetch a single role by `roleId` or by `name`       | getRole({ roleId: "abc123" })`or`getRole({ name: "Owner" })`                                                   |
| updateRole  | Update role name, description, and/or permissions  | updateRole({ roleId: "abc123", name: "Lead", permissions: ["team.add_member"] })`                              |
| deleteRole  | Delete a role by id (no-op if role does not exist) | deleteRole({ roleId: "abc123" })`                                                                              |

#### Items

| Router name | Use case                                    | Params                                         |
| ----------- | ------------------------------------------- | ---------------------------------------------- |
| createItem  | Create a new item profile                   | createItem({ nsn, name, description, teamId }) |
| getItem     | Retrieve a single item by ID                | getItem({ itemId })                            |
| listItems   | List items for a team with optional filters | listItems({ teamId, limit })                   |
| updateItem  | Update item profile fields                  | updateItem({ itemId, name, description })      |
| deleteItem  | Soft-delete or hard-delete an item          | deleteItem({ itemId })                         |

#### Home

| Router name | Use case                                    | Params                |
| ----------- | ------------------------------------------- | --------------------- |
| hardReset   | Delete all items and all S3 images for team | hardReset({ teamId }) |
| softReset   | Mark all items as "To Review" for the team  | softReset({ teamId }) |

#### Export

| Router name | Use case                                                                                            | Params                |
| ----------- | --------------------------------------------------------------------------------------------------- | --------------------- |
| getExport   | Run both Python export scripts and return **two CSV files** (one for DA2404 and one for Inventory). | getExport({ teamId }) |

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
