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
import * as apigwIntegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";

import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as kms from "aws-cdk-lib/aws-kms";

import { resolveStage } from "../stage";

// Accept the DynamoDB table + optional CMK so we can wire Lambda permissions
export interface MngInfraStackProps extends cdk.StackProps {
  ddbTable: dynamodb.ITable;
  ddbKey?: kms.IKey;
}

export class MngInfraStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly apiFn: NodejsFunction;
  public readonly distribution: cloudfront.Distribution;
  public readonly webBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: MngInfraStackProps) {
    super(scope, id, props);

    const stage = resolveStage(this.node.root as cdk.App);

    // BACKEND: Lambda (tRPC) + HTTP API
    this.apiFn = new NodejsFunction(this, "TrpcLambda", {
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

        // CORS envs your handler might read
        CORS_ORIGINS: stage.cors.allowOrigins.join(","),
        CORS_HEADERS: stage.cors.allowHeaders.join(","),
        CORS_METHODS: stage.cors.allowMethods.join(","),

        // DynamoDB information
        TABLE_NAME: props.ddbTable.tableName,
        GSI_ITEMS_BY_PROFILE: "GSI_ItemsByProfile",
        GSI_ITEMS_BY_PARENT: "GSI_ItemsByParent",
        GSI_REPORTS_BY_USER: "GSI_ReportsByUser",
        GSI_REPORTS_BY_ITEM: "GSI_ReportsByItem",
        GSI_LOCATIONS_BY_PARENT: "GSI_LocationsByParent",
        GSI_USERS_BY_UID: "GSI_UsersByUid",
      },
    });

    // Grant Lambda permissions to use the table + CMK
    props.ddbTable.grantReadWriteData(this.apiFn);
    props.ddbKey?.grantEncryptDecrypt(this.apiFn);

    const allowOrigins: string[] = stage.cors.allowOrigins;
    const wildcard = allowOrigins.length === 1 && allowOrigins[0] === "*";

    this.httpApi = new apigwv2.HttpApi(this, "HttpApi", {
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

    const trpcIntegration = new apigwIntegrations.HttpLambdaIntegration(
      "TrpcIntegrationV2",
      this.apiFn
    );

    // tRPC base
    this.httpApi.addRoutes({
      path: "/trpc",
      methods: [apigwv2.HttpMethod.ANY],
      integration: trpcIntegration,
    });

    // tRPC proxy (batching, nested routes)
    this.httpApi.addRoutes({
      path: "/trpc/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: trpcIntegration,
    });

    // FRONTEND: S3 + CloudFront
    this.webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: stage.autoDeleteObjects,
      removalPolicy: stage.removalPolicy,
    });

    // CloudFront OAI for S3 origin
    const oai = new cloudfront.OriginAccessIdentity(this, "WebOAI");
    const s3Origin = origins.S3BucketOrigin.withOriginAccessIdentity(this.webBucket, {
      originAccessIdentity: oai,
    });
    this.webBucket.grantRead(oai);

    // API origin: point to the $default stage host of the HTTP API
    const apiOrigin = new origins.HttpOrigin(
      `${this.httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
      {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      }
    );

    // Behavior for API paths
    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // don't cache API responses
      // Important: don't forward Host; API GW must see its own host
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      compress: true,
    };

    // Distribution with SPA defaults and API routing
    this.distribution = new cloudfront.Distribution(this, "WebDistribution", {
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
      // SPA fallback for client-side routing
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    // Deploy built frontend (point to your actual dist path)
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist"))],
      destinationBucket: this.webBucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
      prune: true,
    });

    // Outputs
    new cdk.CfnOutput(this, "Stage", { value: stage.name });
    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${this.distribution.domainName}` });
    new cdk.CfnOutput(this, "HttpApiInvokeUrl", {
      value: `https://${this.httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
    });
    new cdk.CfnOutput(this, "FunctionName", { value: this.apiFn.functionName });
    new cdk.CfnOutput(this, "TableName", { value: props.ddbTable.tableName });
  }
}
