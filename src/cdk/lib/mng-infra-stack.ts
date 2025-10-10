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

    // Frontend: S3 + CloudFront 
    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: stage.autoDeleteObjects,
      removalPolicy: stage.removalPolicy,
    });

    const oai = new cloudfront.OriginAccessIdentity(this, "WebOAI");
    webBucket.grantRead(oai);

    const distro = new cloudfront.Distribution(this, "WebDistribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(webBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.seconds(0) },
      ],
    });

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist"))],
      destinationBucket: webBucket,
      distribution: distro,
      distributionPaths: ["/*"],
      prune: true,
    });

    // Backend: Lambda + HTTP API 
    const apiFn = new NodejsFunction(this, "TrpcLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../../api/src/handler.ts"),
      handler: "handler",
      memorySize: stage.lambda.memorySize,
      timeout: stage.lambda.timeout,
      bundling: {
        minify: true,
        sourceMap: true,
        target: "es2022",
        format: OutputFormat.CJS,
        banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        NODE_ENV: stage.nodeEnv,   
        STAGE: stage.name,        
        SERVICE_NAME: "mng-api",
        AWS_REGION: this.region,
        CORS_ORIGINS: stage.cors.allowOrigins.join(","),
        CORS_HEADERS: stage.cors.allowHeaders.join(","),
        CORS_METHODS: stage.cors.allowMethods.join(","),
      },
    });

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `mng-http-api-${stage.name}`,
      description: `HTTP API for tRPC (${stage.name})`,
      corsPreflight: {
        allowOrigins: stage.cors.allowOrigins,
        allowMethods: stage.cors.allowMethods.map(m => apigwv2.CorsHttpMethod[m as keyof typeof apigwv2.CorsHttpMethod]),
        allowHeaders: stage.cors.allowHeaders,
      },
    });

    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new apigwv2Integrations.HttpLambdaIntegration("LambdaProxyIntegration", apiFn),
    });

    // CloudFront -> HTTP API
    const apiOrigin = new origins.HttpOrigin(
      `${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`
    );

    distro.addBehavior("/trpc/*", apiOrigin, {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      compress: true,
    });

    new cdk.CfnOutput(this, "Stage", { value: stage.name });
    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${distro.domainName}` });
    new cdk.CfnOutput(this, "HttpApiInvokeUrl", {
      value: `https://${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
    });
  }
}