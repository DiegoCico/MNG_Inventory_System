import type { App, RemovalPolicy, Duration } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';

type StageName = 'dev' | 'prod';

export interface StageConfig {
  name: StageName;
  nodeEnv: 'development' | 'production';
  autoDeleteObjects: boolean;
  removalPolicy: cdk.RemovalPolicy;
  lambda: {
    memorySize: number; // MB
    timeout: cdk.Duration; // seconds
  };
  cors: {
    allowOrigins: string[];
    allowMethods: string[]; // "GET","POST","OPTIONS","PUT","PATCH","DELETE"
    allowHeaders: string[]; //   "content-type","authorization"
  };
  tags?: Record<string, string>;
}

export function resolveStage(app: App): StageConfig {
  const name =
    (app.node.tryGetContext('stage') as StageName) ?? (process.env.STAGE as StageName) ?? 'dev';

  const base: Omit<StageConfig, 'name' | 'nodeEnv'> = {
    autoDeleteObjects: name === 'dev',
    removalPolicy: name === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    lambda: {
      memorySize: name === 'prod' ? 1024 : 512,
      timeout: cdk.Duration.seconds(name === 'prod' ? 20 : 15),
    },
    cors: {
      allowOrigins: ['*'], // tighten later
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization'],
    },
    tags: {
      App: 'MNG-Inventory',
      Stage: name,
    },
  };

  return {
    name,
    nodeEnv: name === 'prod' ? 'production' : 'development',
    ...base,
  };
}
