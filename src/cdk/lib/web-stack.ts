import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export interface WebStackProps extends cdk.StackProps {
  stage: { name: string };
  serviceName?: string;
  frontendBuildPath?: string;
  apiDomainName?: string;
  apiPaths?: string[];
}

export class WebStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly webUrl: string;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const stageName = props.stage.name;
    const serviceName = props.serviceName ?? 'mng-web';

    // ===== S3 Bucket =====
    this.bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: stageName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stageName !== 'prod',
    });

    // ===== CloudFront OAI =====
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `${serviceName}-${stageName}-oai`,
    });
    this.bucket.grantRead(oai);
    const s3Origin = new origins.S3Origin(this.bucket, {
      originAccessIdentity: oai,
    });

    // ===== API Origin =====
    const apiDomainName = props.apiDomainName;
    const apiPaths = props.apiPaths?.length ? props.apiPaths : ['/trpc/*', '/health', '/hello'];

    const additionalBehaviors: Record<string, cloudfront.BehaviorOptions> = {};

    if (apiDomainName) {
      const apiOrigin = new origins.HttpOrigin(apiDomainName, {
        originPath: '',
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      });

      // Allow cookies, query strings, and safe headers
      const apiRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiRequestPolicy', {
        comment: 'Forward cookies and query strings for API requests',
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          'Origin',
          'Referer',
          'Accept',
          'Accept-Language',
          'Content-Type',
        ),
      });

      // Disable caching (CloudFront forwards everything, including Authorization)
      const apiCachePolicy = cloudfront.CachePolicy.CACHING_DISABLED;

      for (const pathPattern of apiPaths) {
        additionalBehaviors[pathPattern] = {
          origin: apiOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: apiRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        };
      }
    }

    // ===== CloudFront Distribution =====
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${serviceName}-${stageName}`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(1),
        },
      ],
    });

    // ===== Deploy Frontend =====
    if (props.frontendBuildPath) {
      const resolved = path.resolve(__dirname, props.frontendBuildPath);
      if (fs.existsSync(resolved)) {
        new s3deploy.BucketDeployment(this, 'DeployFrontend', {
          sources: [s3deploy.Source.asset(resolved)],
          destinationBucket: this.bucket,
          distribution: this.distribution,
          distributionPaths: ['/*'],
          prune: true,
        });
      } else {
        console.warn(`[WebStack] Skipping deployment — path not found: ${resolved}`);
      }
    }

    // ===== Outputs =====
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'ApiDomainName', {
      value: apiDomainName ?? 'No API domain provided',
    });

    this.webUrl = `https://${this.distribution.distributionDomainName}`;
  }
}
