# Frontend

The frontend folder contains the client-facing application for the Inventory Management System. It is responsible for rendering user interfaces, interacting with the API through typed TRPC endpoints, handling authentication flows, managing state, and presenting inventory, team, and item information.

### Current components
These are the major functional areas in the frontend based on the repository structure.
- Entry and routing: Main application entrypoint and route definitions for pages and views.
- Authentication flows: Sign-in, invite acceptance, password challenge, refresh handling, and logout views. Communicates with Cognito through the backend API.
- Teamspace views: UI for creating, listing, and managing teamspaces and members.
- Item profiles: Page states and components for viewing, editing, and creating item profiles including associated images.
- S3 image handling: Upload widgets, preview logic, and retrieval of existing images using signed URLs.
- Roles and permissions: Interfaces for listing, creating, and editing role definitions. Relies on backend permission enforcement but exposes role management options.
- Navigation and layout: Sidebar, top-level navigation, protected route handling, and layout wrappers.
- Forms and data entry: Components handling creation and editing of items, workspaces, and supporting metadata fields.
- State management and API client: TRPC React client initialization, session state storage, and query/mutation triggers.

### Usage of current components

Entry and routing
- Initializes the TRPC client using the API Gateway domain exported by the CDK WebStack.
- Uses route guards to prevent access to protected pages without a valid session.
- Exposes public pages for sign-in and invitation acceptance.

### Authentication flows
- Initiates sign-in requests through the API’s Auth router.
- Receives Cognito challenge states (NEW_PASSWORD_REQUIRED, MFA) from the API and displays appropriate challenge UI.
- On successful authentication, reads cookies set by the API and transitions the app into authenticated mode.
- Provides logout actions that clear session state and redirect to the sign-in page.

### Teamspace views
- Displays a list of all teamspaces associated with the authenticated user.
- Supports creating new teamspaces by sending createTeamspace requests to the API.
- Allows adding and removing teamspace members via email identity lookup.
- Reads role membership and permissions returned from the API.

### Item profiles
- Shows item detail pages populated by caller.itemProfiles.get and related list endpoints.
- Supports creation and update of item profiles, including name, NSN, description, parent items, and last known location.
- Reads image references for each item and delegates image upload and retrieval to the S3 components.
- Uses pagination, filtering, and breadcrumbs using the properties sent back by the API.

### S3 image handling
- Provides an upload UI allowing images to be selected and previewed before upload.
- Converts selected files to data URLs for uploadImage API calls.
- Fetches signed HEAD URLs using getSignedUrl to check existence or load previews.
- Lists stored images using prefixes derived from teamspace, item, and scope.

### Roles and permissions
- Fetches role definitions from the API, including name, description, and permission lists.
- Allows creation of new roles using createRole.
- Supports editing roles, including updating names and permission arrays.
- Displays users' effective permissions based on the API’s interpretation.

### Navigation and layout
- Provides the global sidebar and top bar showing navigation targets such as Items, Teamspaces, Roles, and Settings.
- Uses role and permission information to conditionally render or hide navigation options.
- Wraps authenticated views in a layout that includes async loading boundaries and error displays.

### Forms and data entry
- Contains reusable form components for text, numbers, dates, dropdowns, and image uploads.
- Connects forms to TRPC mutations for create, update, and delete operations within teamspaces and item modules.
- Displays server-side error messages coming from Zod validations inside the API.

### State management and API client
- Defines the TRPC React client using the API’s base URL generated from WebStack outputs.
- Provides caching, invalidation, optimistic updates, and data fetching behavior per API contract.
- Stores session identity in memory and revalidates via Auth.me on initial load.

### Example usage
The frontend typically interacts with the backend in patterns such as:
- On page load, call auth.me to determine if the user is authenticated.
- When creating a teamspace, call teamspace.createTeamspace with the user’s ID.
- To upload an image, convert file input to data URL and call s3.uploadImage, then refresh previews.
- When viewing an item, call itemProfiles.get and listImages to populate the detail page.

### Example integration
When the user edits an item profile and attaches a new image:
- The form reads existing item data through itemProfiles.get.
- The upload component converts a selected file into data URL format.
- The S3 router uploadImage method stores the image in the uploads bucket.
- The page refreshes by calling listImages to show the updated gallery.