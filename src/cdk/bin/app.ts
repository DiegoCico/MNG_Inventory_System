import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MngInfraStack } from "../lib/mng-infra-stack";
import { resolveStage } from "../stage";

const app = new cdk.App();
const cfg = resolveStage(app);

const stack = new MngInfraStack(app, `MngInfra-${cfg.name}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// Apply tags from stage config
if (cfg.tags) {
  Object.entries(cfg.tags).forEach(([k, v]) => cdk.Tags.of(stack).add(k, v));
}
