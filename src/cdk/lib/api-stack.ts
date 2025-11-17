import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export interface ApiStackProps extends cdk.StackProps {
  stage: {
    name: string;
    nodeEnv: string;
    lambda: { memorySize: number; timeout: cdk.Duration };
    cors: {
      allowCredentials: boolean;
      allowHeaders: string[];
      allowMethods: apigwv2.CorsHttpMethod[];
      allowOrigins: string[];
      maxAge?: cdk.Duration;
    };
  };
  ddbTable: dynamodb.Table;
  serviceName?: string;
}

export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly apiFn: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const stage = props.stage;
    const serviceName = props.serviceName ?? 'mng-api';

    console.log(`[ApiStack] stage=${stage.name} service=${serviceName}`);

    // Lambda (tRPC)
    this.apiFn = new NodejsFunction(this, 'TrpcLambda', {
      functionName: `${serviceName}-${stage.name}-trpc`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(__dirname, '../../api/src/handler.ts'),
      handler: 'handler',
      memorySize: stage.lambda.memorySize,
      timeout: stage.lambda.timeout,
      bundling: {
        format: OutputFormat.CJS,
        target: 'node20',
        minify: true,
        sourceMap: true,
        externalModules: ['aws-sdk', '@aws-sdk/*'],
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        NODE_ENV: stage.nodeEnv,
        STAGE: stage.name,
        SERVICE_NAME: serviceName,
        TABLE_NAME: props.ddbTable.tableName,
        APP_REGION: cdk.Stack.of(this).region,
      },
    });

    // DDB permissions
    props.ddbTable.grantReadWriteData(this.apiFn);

    // HTTP API (v2)
    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: serviceName,
      corsPreflight: {
        allowOrigins: stage.cors.allowOrigins,
        allowHeaders: stage.cors.allowHeaders,
        allowMethods: stage.cors.allowMethods,
        allowCredentials: stage.cors.allowCredentials,
        maxAge: stage.cors.maxAge,
      },
    });

    const lambdaIntegration = new apigwIntegrations.HttpLambdaIntegration(
      'LambdaIntegration',
      this.apiFn,
    );

    // /trpc/* proxy → Lambda
    new apigwv2.HttpRoute(this, 'TrpcProxy', {
      httpApi: this.httpApi,
      routeKey: apigwv2.HttpRouteKey.with('/trpc/{proxy+}', apigwv2.HttpMethod.ANY),
      integration: lambdaIntegration,
    });

    // /health → Lambda
    new apigwv2.HttpRoute(this, 'HealthRoute', {
      httpApi: this.httpApi,
      routeKey: apigwv2.HttpRouteKey.with('/health', apigwv2.HttpMethod.GET),
      integration: lambdaIntegration,
    });

    // Outputs
    new cdk.CfnOutput(this, 'HttpApiInvokeUrl', {
      value: `https://${this.httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
    });
    new cdk.CfnOutput(this, 'FunctionName', { value: this.apiFn.functionName });
    new cdk.CfnOutput(this, 'TableName', { value: props.ddbTable.tableName });
  }
}
