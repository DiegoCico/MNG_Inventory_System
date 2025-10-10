#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack';

const app = new App();

// pull env from context or process.env
const stage = app.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? 'us-east-1';

// pass allowed origins via context 
const allowedOriginsCtx = app.node.tryGetContext('allowedOrigins') as string[] | undefined;
const allowedOriginPatternsCtx = app.node.tryGetContext('allowedOriginPatterns') as string[] | undefined;

new ApiStack(app, `MNG-Api-${stage}`, {
  env: { account, region },
  stage,
  allowedOrigins: allowedOriginsCtx,
  allowedOriginPatterns: allowedOriginPatternsCtx,
});
