// src/cdk/lib/web-stack.ts
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
  frontendBuildPath?: string; // e.g. "../../frontend/dist"
}

export class WebStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const stageName = props.stage.name;
    const serviceName = props.serviceName ?? "mng-web";
    console.log(`[WebStack] stage=${stageName} service=${serviceName}`);

    // Private site bucket
    this.bucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `${serviceName}-${stageName}-${cdk.Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy:
        stageName === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stageName === "prod" ? false : true,
    });

    // OAI
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
      comment: `${serviceName}-${stageName}-oai`,
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessIdentity(this.bucket, {
      originAccessIdentity: oai,
    });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `${serviceName}-${stageName}`,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.minutes(1) },
      ],
    });

    // Deploy static assets only if path exists
    if (props.frontendBuildPath) {
      const resolved = path.resolve(__dirname, props.frontendBuildPath);
      if (fs.existsSync(resolved)) {
        console.log(`[WebStack] Deploying static assets from: ${resolved}`);
        new s3deploy.BucketDeployment(this, "DeploySite", {
          sources: [s3deploy.Source.asset(resolved)],
          destinationBucket: this.bucket,
          distribution: this.distribution,
          distributionPaths: ["/*"],
          prune: true,
        });
      } else {
        console.warn(`[WebStack] Skipping asset deploy — not found: ${resolved}. Build your web or remove 'frontendBuildPath'.`);
      }
    }

    new cdk.CfnOutput(this, "Stage", { value: stageName });
    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${this.distribution.distributionDomainName}` });
  }
}
