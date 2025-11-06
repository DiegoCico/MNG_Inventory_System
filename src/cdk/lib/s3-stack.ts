import {
  Stack,
  StackProps,
  CfnOutput,
  RemovalPolicy,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as iam from "aws-cdk-lib/aws-iam";

export interface S3UploadsStackProps extends StackProps {
  stage: string;
  serviceName?: string;
}

export class S3UploadsStack extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly key: kms.Key;

  constructor(scope: Construct, id: string, props: S3UploadsStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const isProd = stage === "prod";
    const service = (props.serviceName ?? "mng-uploads").toLowerCase();

    /* =========================================================================
       KMS Key (encryption for S3 uploads)
    ========================================================================= */
    this.key = new kms.Key(this, "UploadsKey", {
      alias: `${service}-${stage}-kms-key`,
      enableKeyRotation: true,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      description: `KMS key for encrypting uploaded files in ${stage}`,
    });

    /* =========================================================================
       S3 Bucket (private, encrypted, SSL enforced)
    ========================================================================= */
    this.bucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: `${service}-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.key,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedOrigins: ["*"], // TODO: restrict to your CloudFront + API origins
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: Duration.hours(1).toSeconds(),
        },
      ],
      lifecycleRules: [
        {
          id: "cleanup-temp",
          prefix: "temp/",
          expiration: Duration.days(90),
          enabled: true,
        },
      ],
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    /* =========================================================================
       Security Policy: Deny Unencrypted Uploads
    ========================================================================= */
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DenyUnEncryptedUploads",
        effect: iam.Effect.DENY,
        actions: ["s3:PutObject"],
        resources: [`${this.bucket.bucketArn}/*`],
        conditions: {
          StringNotEquals: {
            "s3:x-amz-server-side-encryption": "aws:kms",
          },
        },
        principals: [new iam.AnyPrincipal()],
      })
    );

    /* =========================================================================
        Outputs (for cross-stack imports, monitoring, and CI visibility)
    ========================================================================= */
    new CfnOutput(this, "BucketName", { value: this.bucket.bucketName });
    new CfnOutput(this, "BucketArn", { value: this.bucket.bucketArn });
    new CfnOutput(this, "KmsKeyArn", { value: this.key.keyArn });
    new CfnOutput(this, "BucketRegion", { value: this.region });
  }

  /**
   * Grants full read/write/delete + KMS encrypt/decrypt permissions
   * to another role (e.g., API Lambda)
   */
  grantApiAccess(role: iam.IRole) {
    this.bucket.grantReadWrite(role);
    this.key.grantEncryptDecrypt(role);
  }
}
