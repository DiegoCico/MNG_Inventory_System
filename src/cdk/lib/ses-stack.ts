import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as ses from "aws-cdk-lib/aws-ses";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";

export interface SesStackProps extends cdk.StackProps {
  /** Root domain for prod/staging identities */
  rootDomain: string;
  /** Local part if using domain identity (default: noreply) */
  fromLocalPart?: string;
  /** Create SNS feedback topic (default: true) */
  createFeedbackTopic?: boolean;
  /** Deployment stage name (dev | staging | prod ...) */
  stage?: string;
  emailFrom?: string;
}

export class SesStack extends cdk.Stack {
  public readonly fromAddress: string;
  public readonly configurationSetName: string;
  public readonly feedbackTopicArn?: string;

  constructor(scope: Construct, id: string, props: SesStackProps) {
    super(scope, id, props);

    const {
      rootDomain,
      fromLocalPart = "noreply",
      createFeedbackTopic = true,
      stage = "dev",
      emailFrom = "cicotoste.d@northeastern.edu",    
    } = props;

    //  determine identity type 
    let identity: ses.EmailIdentity;
    let fromAddress: string;

    if (stage === "dev") {
      // simple verified-email identity (no Route53 required)
      fromAddress = emailFrom ;
      identity = new ses.EmailIdentity(this, "EmailIdentityDev", {
        identity: ses.Identity.email(fromAddress),
      });
    } else {
      // domain identity for non-dev environments
      const zone = route53.HostedZone.fromLookup(this, "HostedZone", {
        domainName: rootDomain,
      });
      identity = new ses.EmailIdentity(this, "DomainIdentity", {
        identity: ses.Identity.publicHostedZone(zone),
        mailFromDomain: `mail.${rootDomain}`,
      });
      fromAddress = `${fromLocalPart}@${rootDomain}`;
    }

    this.fromAddress = fromAddress;

    //  configuration set 
    const cfgName = `cfg-${cdk.Stack.of(this).stackName}`;
    const cfg = new ses.CfnConfigurationSet(this, "ConfigSet", {
      name: cfgName,
      reputationOptions: { reputationMetricsEnabled: true },
      sendingOptions: { sendingEnabled: true },
      suppressionOptions: { suppressedReasons: ["BOUNCE", "COMPLAINT"] },
      deliveryOptions: { tlsPolicy: "REQUIRE" },
    });
    this.configurationSetName = cfg.name!;

    //  optional SNS feedback topic
    let feedbackTopicArn: string | undefined;
    if (createFeedbackTopic) {
      const feedbackTopic = new sns.Topic(this, "SesFeedbackTopic", {
        displayName: `SES Feedback (${stage})`,
      });

      feedbackTopic.addToResourcePolicy(
        new iam.PolicyStatement({
          principals: [new iam.ServicePrincipal("ses.amazonaws.com")],
          actions: ["SNS:Publish"],
          resources: [feedbackTopic.topicArn],
          conditions: {
            StringEquals: { "AWS:SourceAccount": this.account },
            ArnLike: {
              "AWS:SourceArn": `arn:aws:ses:${this.region}:${this.account}:configuration-set/${cfgName}`,
            },
          },
        })
      );

      new ses.CfnConfigurationSetEventDestination(this, "CfgSetEvents", {
        configurationSetName: cfgName,
        eventDestination: {
          name: "sns-destination",
          enabled: true,
          matchingEventTypes: [
            "SEND",
            "REJECT",
            "BOUNCE",
            "COMPLAINT",
            "DELIVERY",
            "OPEN",
            "CLICK",
            "RENDERING_FAILURE",
          ],
          snsDestination: { topicArn: feedbackTopic.topicArn },
        },
      });

      feedbackTopicArn = feedbackTopic.topicArn;
      this.feedbackTopicArn = feedbackTopicArn;
    }

    //  managed policy for Lambda/API to send mail 
    const sendPolicy = new iam.ManagedPolicy(this, "SesSendPolicy", {
      description:
        "Allow sending via SES from the configured address & configuration set.",
      statements: [
        new iam.PolicyStatement({
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"],
          conditions: {
            StringEquals: {
              "ses:FromAddress": this.fromAddress,
              "ses:ConfigurationSet": cfgName,
            },
          },
        }),
      ],
    });

    //  outputs 
    new cdk.CfnOutput(this, "Stage", { value: stage });
    new cdk.CfnOutput(this, "FromAddress", { value: this.fromAddress });
    new cdk.CfnOutput(this, "IdentityArn", { value: identity.emailIdentityArn });
    new cdk.CfnOutput(this, "ConfigSetName", { value: this.configurationSetName });
    if (feedbackTopicArn) {
      new cdk.CfnOutput(this, "FeedbackTopicArn", { value: feedbackTopicArn });
    }
    new cdk.CfnOutput(this, "SesSendPolicyArn", {
      value: sendPolicy.managedPolicyArn,
      exportName: "SesSendPolicyArn",
    });
  }
}
