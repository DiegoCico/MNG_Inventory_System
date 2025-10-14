import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MngInfraStack } from '../lib/mng-infra-stack';
import { resolveStage } from '../stage';
import { AuthStack } from '../lib/auth-stack';

const app = new cdk.App();
const cfg = resolveStage(app);

const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID ?? '245120345540';
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';

const webOriginsCtx = app.node.tryGetContext('webOrigins');
const webOrigins: string[] =
  Array.isArray(webOriginsCtx) && webOriginsCtx.length ? webOriginsCtx : ['http://localhost:5173']; // dev default

const infra = new MngInfraStack(app, `MngInfra-${cfg.name}`, {
  env: { account, region },
});

if (cfg.tags) {
  Object.entries(cfg.tags).forEach(([k, v]) => cdk.Tags.of(infra).add(k, v));
}

// Add Cognito (invite-only)
const auth = new AuthStack(app, `MngAuth-${cfg.name}`, {
  env: { account, region },
  stage: cfg.name,
  serviceName: 'mng',
  webOrigins,
});

if (cfg.tags) {
  Object.entries(cfg.tags).forEach(([k, v]) => cdk.Tags.of(auth).add(k, v));
}
