import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

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
    const isProd = stage === 'prod';
    const service = (props.serviceName ?? 'mng-uploads').toLowerCase();

    // KMS KEY
    this.key = new kms.Key(this, 'UploadsKey', {
      alias: `${service}-${stage}-kms-key`,
      enableKeyRotation: true,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      description: `KMS key for encrypting uploaded files in ${stage}`,
    });

    // S3 BUCKET
    this.bucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `mng-${stage.toLowerCase()}-uploads-${cdk.Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.key,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: Duration.hours(1).toSeconds(),
        },
      ],
      lifecycleRules: [
        {
          id: 'expire-generated-documents',
          prefix: 'Documents/',
          expiration: Duration.days(30),
          enabled: true,
        },
        {
          id: 'cleanup-temp',
          prefix: 'temp/',
          expiration: Duration.days(90),
          enabled: true,
        },
      ],
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // DEPLOY PYTHON SCRIPTS
    new s3deploy.BucketDeployment(this, 'UploadSpecificPythonFiles', {
      destinationBucket: this.bucket,
      destinationKeyPrefix: 'scripts/',
      sources: [
        s3deploy.Source.asset('./python', {
          exclude: ['**', '!2404-handler.py', '!inventory-handler.py'],
        })
      ],
      prune: true,
    });

    // DEPLOY TEMPLATE
    new s3deploy.BucketDeployment(this, 'UploadTemplatePython', {
      destinationBucket: this.bucket,
      destinationKeyPrefix: 'templates/',
      sources: [
        s3deploy.Source.asset('./templates', {
          exclude: ['!2404-template.pdf'],
        })
      ],
      prune: true,
    });

    // OUTPUTS
    new CfnOutput(this, 'BucketName', { value: this.bucket.bucketName });
    new CfnOutput(this, 'BucketArn', { value: this.bucket.bucketArn });
    new CfnOutput(this, 'KmsKeyArn', { value: this.key.keyArn });
    new CfnOutput(this, 'BucketRegion', { value: this.region });
  }

  // PERMISSIONS FOR API
  grantApiAccess(role: iam.IRole) {
    this.bucket.grantReadWrite(role);
    this.key.grantEncryptDecrypt(role);
  }
}
