import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Hardcode region; change if needed
const AWS_REGION = 'us-east-1';

// Detect Lambda runtime
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Reusable singletons
export const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
});

export const sesClient = new SESv2Client({
  region: AWS_REGION,
});

export const s3Client = new S3Client({
  region: AWS_REGION,
});

export const ddb = new DynamoDBClient({
  region: AWS_REGION,
});

export const doc = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true },
});

export const AWS_CONFIG = {
  region: AWS_REGION,
  isLambda,
  profile: isLambda ? 'lambda-role' : 'default',
};
