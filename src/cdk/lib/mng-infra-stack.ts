// src/cdk/lib/mng-infra-stack.ts
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";

import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";

import { resolveStage } from "../stage";

export class MngInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = resolveStage(this.node.root as cdk.App);

    // BACKEND: Lambda (tRPC) + HTTP API
    const apiFn = new NodejsFunction(this, "TrpcLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../../api/src/handler.ts"),
      handler: "handler",
      memorySize: stage.lambda.memorySize,
      timeout: stage.lambda.timeout,
      bundling: {
        minify: true,
        sourceMap: true,
        target: "node20",
        format: OutputFormat.CJS, // bundle as CJS to match handler
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        NODE_ENV: stage.nodeEnv,
        STAGE: stage.name,
        SERVICE_NAME: "mng-api",
        CORS_ORIGINS: stage.cors.allowOrigins.join(","),  // explicit origins (no "*") if you want credentials
        CORS_HEADERS: stage.cors.allowHeaders.join(","),
        CORS_METHODS: stage.cors.allowMethods.join(","),
      },
    });

    const allowOrigins: string[] = stage.cors.allowOrigins;
    const wildcard = allowOrigins.length === 1 && allowOrigins[0] === "*";

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `mng-http-api-${stage.name}`,
      description: `HTTP API for tRPC (${stage.name})`,
      corsPreflight: {
        allowOrigins,
        allowMethods: stage.cors.allowMethods.map(
          (m: string) => apigwv2.CorsHttpMethod[m as keyof typeof apigwv2.CorsHttpMethod]
        ),
        allowHeaders: stage.cors.allowHeaders,
        // only set allowCredentials when not wildcard
        ...(wildcard ? {} : { allowCredentials: true }),
      },
    });

    const trpcIntegration = new apigwv2Integrations.HttpLambdaIntegration("TrpcIntegrationV2", apiFn);

    // tRPC base
    httpApi.addRoutes({
      path: "/trpc",
      methods: [apigwv2.HttpMethod.ANY],
      integration: trpcIntegration,
    });

    // tRPC proxy (batching, nested routes)
    httpApi.addRoutes({
      path: "/trpc/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: trpcIntegration,
    });

    // FRONTEND: S3 + CloudFront
    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: stage.autoDeleteObjects,
      removalPolicy: stage.removalPolicy,
    });

    // OAI for S3
    const oai = new cloudfront.OriginAccessIdentity(this, "WebOAI");
    const s3Origin = origins.S3BucketOrigin.withOriginAccessIdentity(webBucket, {
      originAccessIdentity: oai,
    });
    webBucket.grantRead(oai);

    // API origin (point to $default stage host)
    const apiOrigin = new origins.HttpOrigin(
      `${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
      {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      }
    );

    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // API responses should not be cached
      // Important: don't forward Host; API GW must see its own host
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      compress: true,
    };

    const distro = new cloudfront.Distribution(this, "WebDistribution", {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      defaultRootObject: "index.html",
      additionalBehaviors: {
        "/trpc": apiBehavior,    // base tRPC path
        "/trpc/*": apiBehavior,  // all procedures + batching
      },
      errorResponses: [
        // SPA fallback to index.html
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.seconds(0) },
      ],
    });

    // Deploy built frontend (point to your actual dist path)
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist"))],
      destinationBucket: webBucket,
      distribution: distro,
      distributionPaths: ["/*"],
      prune: true,
    });

    // Outputs  
    new cdk.CfnOutput(this, "Stage", { value: stage.name });
    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${distro.domainName}` });
    new cdk.CfnOutput(this, "HttpApiInvokeUrl", {
      value: `https://${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
    });
  }
}
