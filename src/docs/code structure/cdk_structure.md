# CDK

The CDK folder defines the infrastructure that supports all runtime components of the system. It contains stack definitions, shared configuration, and cross-stack wiring logic.

### Current components
These are the currently implemented stacks in the CDK folder.
- App (bin/app.ts): Entry point that initializes all stacks, resolves stage configuration, and links stack outputs.
- AuthStack: Creates the authentication layer using Cognito resources and exposes identifiers for use by the API.
- DynamoStack: Creates the primary DynamoDB table and all related indexes used across routers.
- ApiStack: Creates the Lambda-based backend API and associated gateway. Injects environment variables and required permissions.
- WebStack: Creates the CloudFront distribution and the S3 bucket that serves the frontend build artifacts. Configures proxy routes to the API.
- S3UploadsStack: Provides the S3 bucket used exclusively for file uploads (images, documents). Exports bucket identifiers and grants write/read permissions to the API.
- SesStack: Defines the SES identity and configuration set used for system emails such as invitations and onboarding.
- Stage configuration (stage.ts): Central configuration resolver that sets per-environment values used across all stacks.

### Usage of components
Below are the current CDK components and what they provide to the system. These values are consumed by the API, frontend, Lambda handlers, and automated systems through environment variables, stack outputs, and IAM role grants.

#### AuthStack
- Provides Cognito resources: user pool, app client, domain, issuer URLs.
- Supports mandatory email verification and MFA.
- Sets OAuth redirect URLs using stage configuration.
- Makes user pool information available to ApiStack for authentication.

#### DynamoStack
- Creates the main DynamoDB table (${service}-${stage}-data).
- Defines primary keys (PK, SK).
- Enables KMS encryption, PITR, TTL, Contributor Insights, and stage-dependent deletion rules.
- Supplies all GSIs used by the API.  Current GSIs can be found in `dynamo-stack.ts` or in 

#### ApiStack
- Contains the Lambda that executes all API routing logic.
- Wraps the Lambda with API Gateway HTTP API.
- Configures CORS using stage-derived allowed origins.
- Receives and injects: cognito pool identifiers, AllowedOrigins, SES configuration, Dynamo table details and index names, S3 upload bucket name and encryption key, Web distribution URL
- Grants the API Lambda: DynamoDB read/write access, S3 object read/write/delete access, SES send permissions, Cognito admin abilities used by the Auth router.

#### WebStack
- Creates the S3 bucket hosting the built frontend.
- Creates the CloudFront distribution that serves the frontend.
- Proxies requests such as /trpc/*, /health, and /hello to the API.
- Makes the API URL available to the frontend at deploy time.

#### S3UploadsStack
- Provides the uploads bucket for all file-based storage.
- Enables server-side encryption using a managed KMS key.
- Exposes the bucket and key identifiers for API use.
- Grants the API write, delete, and head-object access.

#### SesStack
- Creates the system email identity used for onboarding and notifications.
- Optionally attaches SNS topics if a stage supports feedback logging.
- Exports sender addresses and configuration set names.

#### Stage configuration
- Computes the active stage (dev, prod, optional beta).
- Defines removalPolicy, autoDeleteObjects, tags, Lambda sizing, and CORS policies per environment.
- Provides stage outputs used by all stacks to ensure resources are named and configured consistently.
