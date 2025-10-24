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
  frontendBuildPath?: string;     // "../../frontend/dist"
  apiDomainName?: string;         // e.g. "q2pt62gzbh.execute-api.us-east-1.amazonaws.com"
  apiPaths?: string[];            // default: ["/trpc/*", "/health", "/hello"]
}

export class WebStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const stageName = props.stage.name;
    const serviceName = props.serviceName ?? "mng-web";

    // S3 bucket for static site
    this.bucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy:
        stageName === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stageName !== "prod",
    });

    // CloudFront -> S3 access identity
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
      comment: `${serviceName}-${stageName}-oai`,
    });
    this.bucket.grantRead(oai);

    const s3Origin = new origins.S3Origin(this.bucket, {
      originAccessIdentity: oai,
    });

    // API origin (your HttpApi / API Gateway domain)
    const apiDomainName = props.apiDomainName;
    const apiPaths =
      props.apiPaths && props.apiPaths.length
        ? props.apiPaths
        : ["/trpc/*", "/health", "/hello"];

    const originRequestPolicyForApi = new cloudfront.OriginRequestPolicy(
      this,
      "ForwardApiRequest",
      {
        comment:
          "Forward all headers EXCEPT host, plus all cookies/query, so API Gateway can auth",
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.denyList(
          "host"
        ),
      }
    );

    const additionalBehaviors: Record<string, cloudfront.BehaviorOptions> = {};

    if (apiDomainName) {
      // Origin that points at API Gateway
      const apiOrigin = new origins.HttpOrigin(apiDomainName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
      });

      // Attach CloudFront behaviors for dynamic API paths
      for (const p of apiPaths) {
        additionalBehaviors[p] = {
          origin: apiOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: originRequestPolicyForApi,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        };
      }
    }

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `${serviceName}-${stageName}`,

      defaultRootObject: "index.html",

      // Default: serve static app shell from S3
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },

      // Dynamic behaviors: /trpc/*, /health, /hello -> API Gateway
      additionalBehaviors,

      // SPA fallback so client-side routing works
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(1),
        },
      ],
    });

    //. Upload frontend build into S3 + invalidate CF cache on deploy
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
        console.warn(
          `[WebStack] Skipping deploy — not found: ${resolved}`
        );
      }
    }

    new cdk.CfnOutput(this, "Stage", { value: stageName });

    new cdk.CfnOutput(this, "SiteUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
    });
  }
}
