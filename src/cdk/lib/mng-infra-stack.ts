import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';

import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class MngInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Frontend: S3 + CloudFront
    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true, // dev-friendly; consider RETAIN for prod
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const oai = new cloudfront.OriginAccessIdentity(this, 'WebOAI');
    webBucket.grantRead(oai);

    const distro = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(webBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        // SPA fallback
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    // Deploy the built frontend (run `npm run build -w src/frontend` first)
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../frontend/dist')),
      ],
      destinationBucket: webBucket,
      distribution: distro,
      distributionPaths: ['/*'],
      prune: true,
    });

    // Backend: Lambda + HTTP API (v2)
    const apiFn = new NodejsFunction(this, 'TrpcLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../api/src/handler.ts'), // must export `handler`
      handler: 'handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2022',
        format: OutputFormat.CJS,
        // Helps when mixing ESM deps with CJS output
        banner:
          "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        NODE_ENV: 'production',
        STAGE: 'prod',
        SERVICE_NAME: 'mng-api',
        AWS_REGION: this.region,
        // lock these down if you want stricter CORS at the handler level
        CORS_ORIGINS: '*',
        CORS_HEADERS: '*',
        CORS_METHODS: 'GET,POST,OPTIONS',
      },
    });

    // API Gateway v2 (HTTP API) with Lambda proxy integration
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'mng-http-api',
      description: 'HTTP API for tRPC (payload v2.0)',
      corsPreflight: {
        allowOrigins: ['*'], // CloudFront same-origin means CORS won’t be used in prod
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['*'],
      },
    });

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        'LambdaProxyIntegration',
        apiFn
      ),
    });

    // CloudFront behavior to route /trpc/* → HTTP API
    // HTTP API uses the $default stage on the root (no /prod path).
    const apiOrigin = new origins.HttpOrigin(
      `${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`
    );

    distro.addBehavior('/trpc/*', apiOrigin, {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy:
        cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      compress: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${distro.domainName}`,
    });

    new cdk.CfnOutput(this, 'HttpApiInvokeUrl', {
      value: `https://${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
    });
  }
}
