import { fromIni } from "@aws-sdk/credential-provider-ini";
import { 
  CognitoIdentityProviderClient 
} from "@aws-sdk/client-cognito-identity-provider";
import { 
  SESv2Client 
} from "@aws-sdk/client-sesv2";
import { 
  S3Client 
} from "@aws-sdk/client-s3";

// Hardcode region; change if needed
const AWS_REGION = "us-east-1";

// Detect Lambda runtime
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Use local credentials profile when not in Lambda
const credentials = isLambda ? undefined : fromIni({ profile: "mng" });

// Reusable singletons
export const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
  credentials,
});

export const sesClient = new SESv2Client({
  region: AWS_REGION,
  credentials,
});

export const s3Client = new S3Client({
  region: AWS_REGION,
  credentials,
});

export const AWS_CONFIG = { 
  region: AWS_REGION, 
  isLambda, 
  profile: isLambda ? "lambda-role" : "mng" 
};
