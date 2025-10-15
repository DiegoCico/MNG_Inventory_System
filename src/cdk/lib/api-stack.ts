import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwIntegrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

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
    const serviceName = props.serviceName ?? "mng-api";

    console.log(`[ApiStack] stage=${stage.name} service=${serviceName}`);

    this.apiFn = new NodejsFunction(this, "TrpcLambda", {
      functionName: `${serviceName}-${stage.name}-trpc`,
      runtime: lambda.Runtime.NODEJS_20_X,
      // IMPORTANT: from src/cdk/lib -> ../../api/src/handler.ts
      entry: path.resolve(__dirname, "../../api/src/handler.ts"),
      handler: "handler",
      memorySize: stage.lambda.memorySize,
      timeout: stage.lambda.timeout,
      bundling: {
        format: OutputFormat.CJS,
        target: "node20",
        minify: true,
        sourceMap: true,
        externalModules: ["aws-sdk"],
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        NODE_ENV: stage.nodeEnv,
        STAGE: stage.name,
        SERVICE_NAME: serviceName,
        TABLE_NAME: props.ddbTable.tableName,
      },
    });

    props.ddbTable.grantReadWriteData(this.apiFn);

    // inside ApiStack constructor
    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
    apiName: props.serviceName ?? "mng-api",
    corsPreflight: {
        allowOrigins: props.stage.cors.allowOrigins,         // e.g. https://d2cktegyq4qcfk.cloudfront.net, http://localhost:5173
        allowHeaders: props.stage.cors.allowHeaders,         // ["content-type", "authorization"]
        allowMethods: props.stage.cors.allowMethods,         // GET,POST,PUT,PATCH,DELETE,OPTIONS
        allowCredentials: props.stage.cors.allowCredentials, // true if you need cookies
        maxAge: props.stage.cors.maxAge,                     // e.g. 12h
    },
    });
    this.httpApi = httpApi;


    const lambdaIntegration = new apigwIntegrations.HttpLambdaIntegration(
      "LambdaIntegration",
      this.apiFn
    );

    new apigwv2.HttpRoute(this, "TrpcProxy", {
      httpApi: this.httpApi,
      routeKey: apigwv2.HttpRouteKey.with("/trpc/{proxy+}", apigwv2.HttpMethod.ANY),
      integration: lambdaIntegration,
    });

    new apigwv2.HttpRoute(this, "HealthRoute", {
      httpApi: this.httpApi,
      routeKey: apigwv2.HttpRouteKey.with("/health", apigwv2.HttpMethod.GET),
      integration: lambdaIntegration,
    });

    new cdk.CfnOutput(this, "HttpApiInvokeUrl", {
      value: `https://${this.httpApi.apiId}.execute-api.${this.region}.amazonaws.com`,
    });
    new cdk.CfnOutput(this, "FunctionName", { value: this.apiFn.functionName });
    new cdk.CfnOutput(this, "TableName", { value: props.ddbTable.tableName });
  }
}
