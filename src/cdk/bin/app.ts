import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";
import { resolveStage } from "../stage";
import { AuthStack } from "../lib/auth-stack";
import { DynamoStack } from "../lib/dynamo-stack";
import { ApiStack } from "../lib/api-stack";
import { WebStack } from "../lib/web-stack";
import { SesStack } from "../lib/ses-stack";

const app = new cdk.App();
const cfg = resolveStage(app) as {
  name: string;
  nodeEnv?: string;
  lambda?: { memorySize?: number; timeoutSeconds?: number };
  cors?: { allowOrigins?: string[] };
  tags?: Record<string, string>;
};

const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID ?? "245120345540";
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-1";

console.log(`[App] synthesizing for stage=${cfg.name} account=${account} region=${region}`);

// Web/API origins
const DEFAULT_DEV_WEB_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const envWebOrigins = (process.env.WEB_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const webOrigins =
  envWebOrigins.length > 0
    ? envWebOrigins
    : cfg.cors?.allowOrigins?.length
    ? cfg.cors.allowOrigins
    : cfg.name === "dev"
    ? DEFAULT_DEV_WEB_ORIGINS
    : ["*"];

const corsAllowOrigins = webOrigins;
const corsAllowCredentials = !(corsAllowOrigins.length === 1 && corsAllowOrigins[0] === "*");

// Auth (Cognito) safe origins & URLs
const authWebOrigins = webOrigins.filter((o) => o !== "*");
const finalAuthWebOrigins =
  authWebOrigins.length > 0
    ? authWebOrigins
    : cfg.name === "dev"
    ? DEFAULT_DEV_WEB_ORIGINS
    : (() => {
        throw new Error(
          "WEB_ORIGINS must be set to concrete URLs for non-dev (no '*') to configure Cognito."
        );
      })();

const sanitizeAuthUrl = (u: string) => {
  const trimmed = u.trim();
  if (!trimmed || trimmed === "*") return null;
  return trimmed.replace(/\/trpc\/auth\//, "/auth/");
};
const fromEnvList = (raw: string) =>
  raw
    .split(",")
    .map((s) => sanitizeAuthUrl(s))
    .filter((x): x is string => !!x);

const envCallbackUrls = fromEnvList(process.env.COGNITO_CALLBACK_URLS ?? "");
const envLogoutUrls = fromEnvList(process.env.COGNITO_LOGOUT_URLS ?? "");

// Stacks

// Auth
const auth = new AuthStack(app, `MngAuth-${cfg.name}`, {
  env: { account, region },
  stage: cfg.name,
  serviceName: "mng",
  webOrigins: finalAuthWebOrigins,
  callbackUrls: envCallbackUrls.length ? envCallbackUrls : undefined,
  logoutUrls: envLogoutUrls.length ? envLogoutUrls : undefined,
});

// Dynamo
const dynamo = new DynamoStack(app, `MngDynamo-${cfg.name}`, {
  env: { account, region },
  stage: cfg.name,
  serviceName: "mng",
});

// API
const api = new ApiStack(app, `MngApi-${cfg.name}`, {
  env: { account, region },
  stage: {
    name: cfg.name,
    nodeEnv: cfg.nodeEnv ?? (cfg.name === "prod" ? "production" : "development"),
    lambda: {
      memorySize: cfg.lambda?.memorySize ?? 512,
      timeout: cdk.Duration.seconds(cfg.lambda?.timeoutSeconds ?? 30),
    },
    cors: {
      allowCredentials: corsAllowCredentials,
      allowHeaders: ["content-type", "authorization"],
      allowMethods: [
        apigwv2.CorsHttpMethod.GET,
        apigwv2.CorsHttpMethod.POST,
        apigwv2.CorsHttpMethod.PUT,
        apigwv2.CorsHttpMethod.PATCH,
        apigwv2.CorsHttpMethod.DELETE,
        apigwv2.CorsHttpMethod.OPTIONS,
      ],
      allowOrigins: corsAllowOrigins,
      maxAge: cdk.Duration.hours(12),
    },
  },
  ddbTable: dynamo.table,
  serviceName: "mng-api",
});

// Inject Cognito env automatically into API Lambda
api.apiFn.addEnvironment("COGNITO_USER_POOL_ID", auth.userPool.userPoolId);
api.apiFn.addEnvironment("COGNITO_CLIENT_ID", auth.webClient.userPoolClientId);

// Least-privilege IAM for Cognito admin flows
api.apiFn.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    "cognito-idp:AdminCreateUser",
    "cognito-idp:AdminSetUserPassword",
    "cognito-idp:AdminUpdateUserAttributes",
    "cognito-idp:AdminConfirmSignUp",
    "cognito-idp:AdminAddUserToGroup",
    "cognito-idp:AdminGetUser",
    "cognito-idp:ListUsers",
    "cognito-idp:AdminInitiateAuth",
    "cognito-idp:AdminRespondToAuthChallenge",
    "cognito-idp:DescribeUserPool",
  ],
  resources: [auth.userPool.userPoolArn],
}));

// ---- SES
const ses = new SesStack(app, `MngSes-${cfg.name}`, {
  env: { account, region },
  stage: cfg.name,
  rootDomain: "example.com", // TODO: set main domain later
  fromLocalPart: "noreply",
  createFeedbackTopic: true,
  emailFrom: "cicotoste.d@northeastern.edu",
});

// Grant API Lambda SES send permissions/vars
api.apiFn.role?.addManagedPolicy(ses.node.tryFindChild("SesSendPolicy") as iam.ManagedPolicy);
api.apiFn.addEnvironment("SES_FROM_ADDRESS", ses.fromAddress);
api.apiFn.addEnvironment("SES_CONFIG_SET", ses.configurationSetName);

// SES least-privilege IAM
api.apiFn.addToRolePolicy(new iam.PolicyStatement({
  sid: "AllowSesSendFromVerifiedFromAddress",
  actions: ["ses:SendEmail", "ses:SendRawEmail"],
  resources: ["*"],
  conditions: {
    StringEquals: {
      "ses:FromAddress": ses.fromAddress,
    },
  },
}));

// Wire API → Web
const apiEndpoint = api.httpApi.apiEndpoint; // https://abc123.execute-api.us-east-1.amazonaws.com
const apiDomainName = cdk.Fn.select(2, cdk.Fn.split("/", apiEndpoint)); // abc123.execute-api.us-east-1.amazonaws.com

// Web
const web = new WebStack(app, `MngWeb-${cfg.name}`, {
  env: { account, region },
  stage: { name: cfg.name },
  serviceName: "mng-web",
  frontendBuildPath: "../../frontend/dist",
  apiDomainName,
  apiPaths: ["/trpc/*", "/health", "/hello"],
});

// Tags
if (cfg.tags) {
  [auth, dynamo, api, web, ses].forEach((stack) => {
    Object.entries(cfg.tags!).forEach(([k, v]) => cdk.Tags.of(stack).add(k, v));
  });
}
