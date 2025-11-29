import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';


export interface ExportLambdaStackProps extends StackProps {
  stage: string;
  serviceName: string;
  ddbTable: dynamodb.ITable;
  uploadsBucket: s3.IBucket;
  kmsKey: any;  // Add KMS key
  region?: string;
}

export class ExportLambdaStack extends Stack {
  public readonly pdf2404Function: lambda.Function;
  public readonly inventoryFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ExportLambdaStackProps) {
    super(scope, id, props);

    const service = (props.serviceName ?? 'mng').toLowerCase();
    const stage = props.stage.toLowerCase();
    const { ddbTable, uploadsBucket, kmsKey, region = 'us-east-1' } = props;

    const commonEnv = {
      TABLE_NAME: ddbTable.tableName,
      UPLOADS_BUCKET: uploadsBucket.bucketName,
      KMS_KEY_ARN: kmsKey.keyArn,  // Add KMS key ARN
      REGION: region,
      TEMPLATE_PATH: 'templates/2404-template.pdf',
    };

    this.pdf2404Function = new lambda.Function(this, 'Export2404Handler', {
      functionName: `${service}-export-2404-handler-${stage}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: '2404-lambda.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-2404')),
      environment: commonEnv,
      timeout: Duration.seconds(60),
      memorySize: 512,
      description: 'Generates DA Form 2404 PDFs for inventory items',
    });

    this.inventoryFunction = new lambda.Function(this, 'ExportInventoryHandler', {
      functionName: `${service}-export-inventory-handler-${stage}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'inventory-lambda.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-inventory')),
      environment: commonEnv,
      timeout: Duration.seconds(60),
      memorySize: 512,
      description: 'Generates inventory CSV reports',
    });

    ddbTable.grantReadData(this.pdf2404Function);
    ddbTable.grantReadData(this.inventoryFunction);

    uploadsBucket.grantReadWrite(this.pdf2404Function);
    uploadsBucket.grantReadWrite(this.inventoryFunction);

    this.pdf2404Function.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject'],
        resources: [`${uploadsBucket.bucketArn}/templates/*`],
      })
    );

    new CfnOutput(this, 'Pdf2404FunctionArn', {
      value: this.pdf2404Function.functionArn,
    });

    new CfnOutput(this, 'InventoryFunctionArn', {
      value: this.inventoryFunction.functionArn,
    });
  }

  public grantInvoke(grantee: iam.IGrantable) {
    this.pdf2404Function.grantInvoke(grantee);
    this.inventoryFunction.grantInvoke(grantee);
  }
}