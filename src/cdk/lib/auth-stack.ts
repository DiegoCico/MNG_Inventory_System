import { Stack, StackProps, CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export interface AuthStackProps extends StackProps {
  stage: string;
  serviceName?: string;
  webOrigins: string[];
  callbackUrls?: string[];
  logoutUrls?: string[];
  sesVerifiedDomain?: string;
  sesFromAddress: string;
  sesIdentityArn: string;
  mfaMode?: 'ON' | 'OPTIONAL';
}

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly webClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const service = (props.serviceName ?? 'mng').toLowerCase();
    const stage = props.stage.toLowerCase();
    const mfaMode = props.mfaMode ?? 'ON';

    const callbacks = props.callbackUrls?.length
      ? props.callbackUrls
      : props.webOrigins.map((o) => `${o.replace(/\/$/, '')}/auth/callback`);

    const logouts = props.logoutUrls?.length
      ? props.logoutUrls
      : props.webOrigins.map((o) => `${o.replace(/\/$/, '')}/auth/logout`);

    // Email channel
    const verificationEmailChannel = props.sesVerifiedDomain
      ? cognito.UserPoolEmail.withSES({
          sesRegion: this.region,
          fromEmail: `no-reply@${props.sesVerifiedDomain}`,
          fromName: `${service.toUpperCase()} ${stage.toUpperCase()}`,
          sesVerifiedDomain: props.sesVerifiedDomain,
        })
      : cognito.UserPoolEmail.withCognito();

    // User pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${service}-${stage}-users`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },

      customAttributes: {
        name: new cognito.StringAttribute({ mutable: true }),
      },

      userVerification: {
        emailSubject: 'Verify your email for MNG Inventory System',
        emailBody: 'Hello, your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },

      mfa: mfaMode === 'ON' ? cognito.Mfa.REQUIRED : cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: false, sms: false },

      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(7),
      },

      email: verificationEmailChannel,

      removalPolicy: stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    // L1 overrides for EMAIL_OTP
    const cfnPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    cfnPool.enabledMfas = ['EMAIL_OTP'];
    cfnPool.mfaConfiguration = mfaMode;
    cfnPool.emailConfiguration = {
      emailSendingAccount: 'DEVELOPER',
      from: props.sesFromAddress,
      sourceArn: props.sesIdentityArn,
    };

    // Hosted UI Domain
    const domainPrefix = `${service}-${stage}`.replace(/[^a-z0-9-]/g, '');
    const domain = this.userPool.addDomain('HostedUiDomain', {
      cognitoDomain: { domainPrefix },
    });

    // Web client
    this.webClient = new cognito.UserPoolClient(this, 'WebClient', {
      userPool: this.userPool,
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

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolArn', { value: this.userPool.userPoolArn });
    new CfnOutput(this, 'UserPoolClientId', {
      value: this.webClient.userPoolClientId,
    });
    new CfnOutput(this, 'HostedUiDomain', { value: domain.domainName });
    new CfnOutput(this, 'IssuerUrl', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
    });
    new CfnOutput(this, 'JwksUri', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}/.well-known/jwks.json`,
    });
  }
}
