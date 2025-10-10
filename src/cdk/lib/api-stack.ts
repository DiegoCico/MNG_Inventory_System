import { Duration, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HttpApi, CorsHttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

interface ApiStackProps extends StackProps {
  stage?: string;
  allowedOrigins?: string[];
  allowedOriginPatterns?: string[];
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps = {}) {
    super(scope, id, props);

    const stage = props.stage ?? 'dev';

    // Lambda that runs Express/tRPC.
    const apiFn = new NodejsFunction(this, 'ApiFn', {
      entry: path.join(__dirname, '../../api/src/handler.ts'), 
      handler: 'handler',                                 
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(15),
      tracing: Tracing.ACTIVE,
      bundling: {
        // keep external if needed, or let it bundle everything
        externalModules: [],
      },
      environment: {
        NODE_ENV: stage === 'prod' ? 'production' : 'development',
        STAGE: stage,
        AWS_REGION: this.region,
        // We will set ALLOWED_ORIGINS and ALLOWED_ORIGIN_PATTERNS below
      },
    });

    // HTTP API fronting the Lambda
    const httpApi = new HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowMethods: [CorsHttpMethod.ANY],
        allowOrigins: ['*'], 
        allowHeaders: ['*'],
      },
    });

    // Lambda proxy integration
    const integration = new HttpLambdaIntegration('LambdaIntegration', apiFn);
    httpApi.addRoutes({
      path: '/{proxy+}',
      integration,
    });

    // Build the execute-api origin 
    const apiExecuteDomain = `${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`;

    // Final allowlist to inject
    const exactOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      `https://${apiExecuteDomain}`,
      ...(props.allowedOrigins ?? []),
    ];

    const originPatterns = props.allowedOriginPatterns ?? []; 

    // Inject env for server.ts to read
    apiFn.addEnvironment('ALLOWED_ORIGINS', JSON.stringify([...new Set(exactOrigins)]));
    apiFn.addEnvironment('ALLOWED_ORIGIN_PATTERNS', originPatterns.join(','));
    apiFn.addEnvironment('API_ID', httpApi.apiId);

    // Useful outputs
    new CfnOutput(this, 'HttpApiEndpoint', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'HttpApiExecuteDomain', { value: apiExecuteDomain });
    new CfnOutput(this, 'Stage', { value: stage });
  }
}
