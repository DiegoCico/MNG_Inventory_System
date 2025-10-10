import type { RemovalPolicy, Duration } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";

export type StageName = "dev" | "beta" | "prod";

export interface StageConfig {
  name: StageName;
  nodeEnv: "development" | "production";
  removalPolicy: RemovalPolicy;
  autoDeleteObjects: boolean;
  cors: {
    allowOrigins: string[];
    allowHeaders: string[];
    allowMethods: ("GET" | "POST" | "OPTIONS")[];
  };
  lambda: {
    memorySize: number;
    timeout: Duration;
  };
  tags?: Record<string, string>;
}

const ALLOW_PROD_DEPLOY = false; 

const COMMON = {
  cors: {
    allowHeaders: ["*"],
    allowMethods: ["GET", "POST", "OPTIONS"] as ("GET" | "POST" | "OPTIONS")[],
  },
  lambda: {
    memorySize: 512,
    timeout: cdk.Duration.seconds(10),
  },
};

const STAGES: Record<StageName, StageConfig> = {
  dev: {
    name: "dev",
    nodeEnv: "development",
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    cors: {
      ...COMMON.cors,
      allowOrigins: ["*"],
    },
    lambda: { ...COMMON.lambda },
    tags: { Stage: "dev", Service: "mng" },
  },
  beta: {
    name: "beta",
    nodeEnv: "development",
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    cors: {
      ...COMMON.cors,
      allowOrigins: ["https://beta.example.com", "*"], // TODO: replace with real domain
    },
    lambda: { ...COMMON.lambda },
    tags: { Stage: "beta", Service: "mng" },
  },
  prod: {
    name: "prod",
    nodeEnv: "production",
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    autoDeleteObjects: false,
    cors: {
      ...COMMON.cors,
      allowOrigins: ["https://app.example.com"], // TODO: replace with real domain
    },
    lambda: { ...COMMON.lambda },
    tags: { Stage: "prod", Service: "mng" },
  },
};

export function resolveStage(app: cdk.App): StageConfig {
  const ctxStage =
    (app.node.tryGetContext("stage") ?? process.env.STAGE ?? "dev") as StageName;

  const stage = (["dev", "beta", "prod"].includes(ctxStage)
    ? ctxStage
    : "dev") as StageName;

  // safety check for prod
  if (stage === "prod" && !ALLOW_PROD_DEPLOY) {
    throw new Error(
      "🚨 Production deployments are currently disabled. To enable, set ALLOW_PROD_DEPLOY = true in stage.ts."
    );
  }

  console.log(`Using stage: ${stage}`);
  return STAGES[stage];
}
