# CDK

Draft 1.1

## Purpose of CDK

CDK in this project defines and deploys all AWS infrastructure for the MNG Inventory System. All infrastructure lives under src/cdk and is written in TypeScript using AWS CDK v2.


## Architecture overview

#### Stacks
The CDK app synthesizes and deploys multiple stacks:
• AuthStack (Cognito user pools + MFA + OAuth callbacks)
• DynamoStack (Main DynamoDB table + GSIs + KMS key)
• ApiStack (Lambda API + API Gateway HTTP API + CORS config + IAM policies + environment variables)
• WebStack (CloudFront distribution + S3 hosting for frontend build + API proxying)
• S3UploadsStack (S3 bucket + KMS for file storage)
• SesStack (SES email identity + configuration set + SNS feedback topic)

#### Bin.ts
All stacks are created and wired together in bin/app.ts, where environment variables, CORS rules, callback URLs, Cognito settings, Dynamo table ARNs, and bucket names are injected. The CDK app determines its stage configuration using resolveStage() from src/cdk/stage.ts. Stages supported: dev and prod (optionally beta, though incomplete in repo).

#### STAGE CONFIG
resolveStage(app) produces:
• name: dev | prod
• nodeEnv (development/production)
• autoDeleteObjects (true in dev)
• removalPolicy (DESTROY in dev, RETAIN in prod)
• lambda: memory & timeout per stage
• cors: allowMethods, allowHeaders, allowOrigins
• tags: applied to all stacks if present

Bootstrap is required once per account/region. The repo includes scripts for bootstrap and per-stage deploys. The CDK app reads account/region from environment variables; otherwise defaults to hardcoded fallbacks.

#### How to run the code
DEVELOPER WORKFLOW
From project root:
nvm use
npm install
npm run build -w src/cdk
npm run synth -w src/cdk
npm run deploy -w src/cdk
(Or individual scripts in src/cdk/package.json like cdk:deploy:dev, cdk:destroy:dev, etc.)

The CDK executes via:
npx ts-node –swc bin/app.ts
defined in cdk.json.

#### INFRA OVERVIEW

##### AuthStack (src/cdk/lib/auth-stack.ts)
Provides Cognito authentication with enforced email verification, enforced MFA via EMAIL_OTP, a hosted UI domain with OAuth authorization code flow, and a web client configured for exact callback and logout URLs derived from allowed origins.
Outputs: UserPoolId, UserPoolArn, WebClientId, Hosted UI domain, issuer URLs, JWKS URI.
Used by ApiStack to validate/authorize users and perform admin user management operations.

##### DynamoStack (src/cdk/lib/dynamo-stack.ts)
Creates encrypted DynamoDB table ${service}-${stage}-data with:
• PK/SK
• DynamoDB KMS-encrypted with customer-managed key (rotation enabled)
• PITR enabled
• Contributor Insights
• TTL
• Deletion protection in prod
• GSIs:
– GSI_WorkspaceByName
– GSI_UsersByUid
– GSI_UsersByUsername
– GSI_RolesByName
– GSI_UserRoleLookup <>
– GSI_ItemsByTeam <>
– GSI_ItemsByAsset <>
– GSI_FormsByAsset <>
– (Continues, need full list from truncated file) <>
Outputs: TableName, TableArn, etc.

##### ApiStack (src/cdk/lib/api-stack.ts)
Creates the Lambda for the API and wraps it with API Gateway v2 HTTP API.
Configures API Gateway CORS using exact allowed origins (CloudFront URL + localhost).
Injects:
• Cognito pool IDs
• API CORS allowOrigins
• SES config
• Dynamo config
• Uploads bucket config
• Allowed origins for per-request Lambda CORS
• WEB_URL (CloudFront URL or override)

##### IAM policies attached:
• Cognito admin permissions (AdminCreateUser, MFA setup, ListUsers, etc.)
• SES sending permission restricted to FromAddress
• Dynamo read/write permissions (full table + indexes)
• S3 uploads bucket permissions (via S3UploadsStack.grantApiAccess)

##### WebStack (src/cdk/lib/web-stack.ts)
Creates a CloudFront distribution + S3 bucket that serves the built frontend.
Proxies /trpc/*, /health, and /hello to the API Gateway endpoint extracted from ApiStack.
Injects the API domain and stage name.
frontendBuildPath points to ../../frontend/dist.

##### S3UploadsStack (src/cdk/lib/s3-stack.ts)
Creates an uploads bucket with KMS encryption for file uploads (images/PDFs/etc.)
Exports bucket name and KMS key ARN.
Provides grantApiAccess(role) to add IAM permissions to the API Lambda.

##### SesStack (src/cdk/lib/ses-stack.ts)
Creates SES identity for sending transactional and onboarding emails.
Includes optional SNS feedback topic and optional Route53 domain logic (skipped in dev/beta).
Exports: fromAddress, configuration set name.

##### 2404/LAMBDA HANDLER
The repo includes Python functions (src/cdk/python/*.py) that stamp PDF templates and save them to S3. These rely on environment variables:
• TEMPLATE_PATH
• TABLE_NAME
• UPLOADS_BUCKET
Injected by ApiStack and/or S3UploadsStack.
Dynamodb lookups, PDF stamping, S3 put operations, and base64 inline PDF response logic are included.

##### CORS AND ORIGINS
CDK explicitly disallows "*" for Access-Control-Allow-Origin because credentialed CORS must use explicit origins.
Allowed origins hardcoded:
• CloudFront distribution URL
• localhost:5173
• 127.0.0.1:5173
These are used for:
• API Gateway CORS
• AuthStack callback/logout URLs
• Lambda ALLOWED_ORIGINS environment variable
• WebStack CloudFront config

##### ENVIRONMENT VARIABLES
Injected into API Lambda:
COGNITO_USER_POOL_ID
COGNITO_CLIENT_ID
APP_SIGNIN_URL
ALLOWED_ORIGINS
SES_FROM_ADDRESS
SES_CONFIG_SET (if exists)
DDB_TABLE_NAME
S3_BUCKET_NAME
S3_KMS_KEY_ARN
WEB_URL

##### DEPLOYMENT
Use workspace scripts from root or from src/cdk:

##### Dev:
npm run cdk:deploy:dev
##### Prod:
ALLOW_PROD_DEPLOY=true npm run cdk:deploy:prod
Destroy:
npm run cdk:destroy:dev

##### STRUCTURE
src/cdk/bin/app.ts assembles and wires stacks.
src/cdk/lib/* contains infrastructure modules.
src/cdk/stage.ts resolves stage config.
src/cdk/package.json defines CDK commands.
src/cdk/tsconfig.json controls build output.
src/cdk/cdk.json defines entrypoint.
src/cdk/cdk-outputs.dev.json shows synthesized outputs after deployment.

##### TO COMPLETE
Provide details for the missing GSI list and any extra stacks not included in the truncated sections:
<>

Provide exact resource definitions inside ApiStack, WebStack, and S3UploadsStack (lib/api-stack.ts, lib/web-stack.ts, lib/s3-stack.ts):
<>

Provide domain configuration details for SES and Route53 if present in your repo or AWS environment:
<>

Provide details on whether additional Lambda functions besides the API and PDF stamper exist:
<>

Provide environment-specific overrides (beta?) if needed:
<>