import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  STAGE: z.string().default('dev'),
  AWS_REGION: z.string().default('us-east-1'),
  SERVICE_NAME: z.string().default('mng-api'),

  DDB_TABLE_NAME: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  S3_KMS_KEY_ARN: z.string().optional(),

  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),

  SES_FROM_ADDRESS: z.string().default('cicotoste.d@northeastern.edu'),
  SES_CONFIG_SET: z.string().optional(),

  ALLOWED_ORIGINS: z.string().optional(),
  APP_SIGNIN_URL: z.string().optional(),
  WEB_URL: z.string().optional(),
});

/* ============================================================================
   Lazy Loader (runtime-safe)
============================================================================ */
export function loadConfig() {
  const env = envSchema.parse(process.env);

  const stage = env.STAGE.toLowerCase();
  const REGION = env.AWS_REGION;
  const SERVICE = env.SERVICE_NAME.toLowerCase();

  const TABLE_NAME = env.DDB_TABLE_NAME ?? `${SERVICE}-${stage}-data`;
  const BUCKET_NAME = env.S3_BUCKET_NAME ?? `${SERVICE}-${stage}-uploads`;

  const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const APP_SIGNIN_URL = env.APP_SIGNIN_URL ?? 'https://d2cktegyq4qcfk.cloudfront.net/signin';

  const WEB_URL = env.WEB_URL ?? 'https://d2cktegyq4qcfk.cloudfront.net';

  const config = {
    env,
    stage,
    REGION,
    TABLE_NAME,
    BUCKET_NAME,
    KMS_KEY_ARN: env.S3_KMS_KEY_ARN,

    COGNITO_USER_POOL_ID: env.COGNITO_USER_POOL_ID ?? '',
    COGNITO_CLIENT_ID: env.COGNITO_CLIENT_ID ?? '',

    SES_FROM: env.SES_FROM_ADDRESS,
    SES_CONFIG_SET: env.SES_CONFIG_SET ?? '',

    ALLOWED_ORIGINS,
    APP_SIGNIN_URL,
    WEB_URL,
  };

  console.log(
    [
      '=============================================================',
      `✅ [process.ts] Loaded stage=${stage.toUpperCase()}`,
      `🌎 Region: ${REGION}`,
      `🧩 Table: ${config.TABLE_NAME}`,
      `🪣 Bucket: ${config.BUCKET_NAME}`,
      `🔐 Cognito Pool: ${config.COGNITO_USER_POOL_ID || 'none'}`,
      `📧 SES From: ${config.SES_FROM}`,
      `🌐 Web URL: ${config.WEB_URL}`,
      '=============================================================',
    ].join('\n'),
  );

  return config;
}
