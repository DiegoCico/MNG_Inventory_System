import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

export interface WebStackProps extends cdk.StackProps {
  stage: { name: string };
  serviceName?: string;
  frontendBuildPath?: string;          // "../../frontend/dist"
  apiDomainName?: string;              // "abc123.execute-api.us-east-1.amazonaws.com"
  apiPaths?: string[];                 // which paths to send to API, default: ["/trpc/*", "/health", "/hello"]
}

export class WebStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const stageName = props.stage.name;
    const serviceName = props.serviceName ?? "mng-web";

    // Static bucket
    this.bucket = new s3.Bucket(this, "WebBucket", {
      bucketName: `${serviceName}-${stageName}-${this.account}-${this.region}`.toLowerCase(),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: stageName === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stageName !== "prod",
    });

    // OAI to read S3
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
      comment: `${serviceName}-${stageName}-oai`,
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessIdentity(this.bucket, {
      originAccessIdentity: oai,
    });

    // Optional API origin
    const apiDomainName = props.apiDomainName;
    const apiPaths = props.apiPaths && props.apiPaths.length
      ? props.apiPaths
      : ["/trpc/*", "/health", "/hello"];

    // Build additional behaviors if API is provided
    const additionalBehaviors: Record<string, cloudfront.BehaviorOptions> = {};
    if (apiDomainName) {
      const apiOrigin = new origins.HttpOrigin(apiDomainName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
      });

      for (const p of apiPaths) {
        additionalBehaviors[p] = {
          origin: apiOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        };
      }
    }

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `${serviceName}-${stageName}`,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors,
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.minutes(1) },
      ],
    });

    // Deploy static assets if present
    if (props.frontendBuildPath) {
      const resolved = path.resolve(__dirname, props.frontendBuildPath);
      if (fs.existsSync(resolved)) {
        new s3deploy.BucketDeployment(this, "DeploySite", {
          sources: [s3deploy.Source.asset(resolved)],
          destinationBucket: this.bucket,
          distribution: this.distribution,
          distributionPaths: ["/*"],
          prune: true,
        });
      } else {
        console.warn(`[WebStack] Skipping asset deploy — not found: ${resolved}`);
      }
    }

    new cdk.CfnOutput(this, "Stage", { value: stageName });
    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${this.distribution.distributionDomainName}` });
  }
}
