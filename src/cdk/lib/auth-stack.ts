import { Stack, StackProps, CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";

export interface AuthStackProps extends StackProps {
  stage: string;
  serviceName?: string;
  webOrigins: string[];
  callbackUrls?: string[];
  logoutUrls?: string[];
  /** Optional: set if you’ve verified a domain in SES; otherwise Cognito email channel is used */
  sesVerifiedDomain?: string;
  /** Optional: SES configuration set name */
  sesConfigurationSet?: string;
}

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly webClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const service = (props.serviceName ?? "mng").toLowerCase();
    const stage = props.stage.toLowerCase();

    // Callback/logout URLs derived from webOrigins if not explicitly provided
    const callbacks = props.callbackUrls?.length
      ? props.callbackUrls
      : props.webOrigins.map((o) => `${o.replace(/\/$/, "")}/auth/callback`);
    const logouts = props.logoutUrls?.length
      ? props.logoutUrls
      : props.webOrigins.map((o) => `${o.replace(/\/$/, "")}/auth/logout`);

    // Email channel: SES (domain-verified) OR Cognito default
    const emailConfig = props.sesVerifiedDomain
      ? cognito.UserPoolEmail.withSES({
          sesRegion: this.region,
          fromEmail: `no-reply@${props.sesVerifiedDomain}`,
          fromName: `${service.toUpperCase()} ${stage.toUpperCase()}`,
          sesVerifiedDomain: props.sesVerifiedDomain,
          // configurationSet: props.sesConfigurationSet,
        })
      : cognito.UserPoolEmail.withCognito();

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${service}-${stage}-users`,
      selfSignUpEnabled: false,                    // invite-only
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      userVerification: {
        emailSubject: "Verify your email for MNG Ineventory System",
        emailBody: "Hello, Your verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      // MFA REQUIRED (TOTP-only) 
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { otp: true, sms: false },  // Software token MFA only
      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      email: emailConfig,
      removalPolicy: stage === "dev" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    // THREAT FOR ESSENTIAL ACCOUNTS: Enforce advanced security features
    // const cfnPool = userPool.node.defaultChild as cognito.CfnUserPool;
    // cfnPool.userPoolAddOns = { advancedSecurityMode: "ENFORCED" };

    // Hosted UI (Cognito domain).
    const domainPrefix = `${service}-${stage}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const domain = userPool.addDomain("HostedUiDomain", {
      cognitoDomain: { domainPrefix },
    });

    const webClient = new cognito.UserPoolClient(this, "WebClient", {
      userPool,
      userPoolClientName: `${service}-${stage}-web`,
      generateSecret: false,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,

      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: callbacks,
        logoutUrls: logouts,
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
      },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    this.userPool = userPool;
    this.webClient = webClient;

    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolArn", { value: userPool.userPoolArn });
    new CfnOutput(this, "UserPoolClientId", { value: webClient.userPoolClientId });
    new CfnOutput(this, "HostedUiDomain", { value: domain.domainName });
    new CfnOutput(this, "IssuerUrl", {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
    });
    new CfnOutput(this, "JwksUri", {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}/.well-known/jwks.json`,
    });
    new CfnOutput(this, "HostedUiAuthorizeUrlExample", {
      value: `https://${domain.domainName}/login?response_type=code&${new URLSearchParams({
        client_id: webClient.userPoolClientId,
        redirect_uri: callbacks[0],
        scope: "openid email profile",
      }).toString()}`,
    });
  }
}
