// lib/dynamo-stack.ts
import { Stack, StackProps, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as kms from "aws-cdk-lib/aws-kms";

export interface DynamoStackProps extends StackProps {
  stage: string;
  serviceName?: string;
}

export class DynamoStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoStackProps) {
    super(scope, id, props);

    const service = (props.serviceName ?? "mng").toLowerCase();
    const stage = props.stage.toLowerCase();
    const isProd = stage === "prod";

    // KMS key for encryption 
    // TABLE IS ONLY FOR US-EAST-1 REGION
    const key = new kms.Key(this, "TableKey", {
      alias: `${service}-${stage}-dynamodb-key`,
      enableKeyRotation: true,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.table = new dynamodb.Table(this, "Table", {
      tableName: `${service}-${stage}-data`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING }, //  "ITEM#123" or "USER#u456"
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },       // "METADATA" or "REPORT#2025-10-13T00:00Z"
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED, // uses CMK
      encryptionKey: key,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      contributorInsightsSpecification: { enabled: true },
      deletionProtection: isProd,       // protect prod from deletes
      timeToLiveAttribute: "ttl",  
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,

      // stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // enable if  Lambda triggers
    });

    // GLOBAL SECONDARY INDEXES

    // GSI1 — Items by Item Profile (list all items of a given item type)
    //   GSI1PK: "ITEM_PROFILE#<profileId>"
    //   GSI1SK: "ITEM#<itemId>"
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_ItemsByProfile",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    // GSI2 — Items by Parent Item (used for kits/assemblies hierarchy)
    //   GSI2PK: "PARENT#<parentItemId>"
    //   GSI2SK: "ITEM#<itemId>"
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_ItemsByParent",
      partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    // GSI3 — Reports by User (get all reports submitted by a user)
    //   GSI3PK: "USER#<userId>"
    //   GSI3SK: "REPORT#<isoTime>#ITEM#<itemId>"
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_ReportsByUser",
      partitionKey: { name: "GSI3PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI3SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    // GSI4 — Reports by Item (alternative access pattern to fetch all reports for an item)
    //   GSI4PK: "ITEM#<itemId>"
    //   GSI4SK: "REPORT#<isoTime>"
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_ReportsByItem",
      partitionKey: { name: "GSI4PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI4SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    // GSI5 — Locations by Parent (location tree traversal)
    //   GSI5PK: "LOC_PARENT#<parentLocId|ROOT>"
    //   GSI5SK: "LOCATION#<locId>"
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_LocationsByParent",
      partitionKey: { name: "GSI5PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI5SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    // GSI6 — Users by External UID (fast auth/user lookup)
    //   GSI6PK: "UID#<cognitoUid>"
    //   GSI6SK: "USER#<userId>"
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_UsersByUid",
      partitionKey: { name: "GSI6PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI6SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    new CfnOutput(this, "TableName", { value: this.table.tableName });
    new CfnOutput(this, "TableArn", { value: this.table.tableArn });
    new CfnOutput(this, "KmsKeyArn", { value: key.keyArn });
    new CfnOutput(this, "Indexes", {
      value: [
        "GSI_ItemsByProfile",
        "GSI_ItemsByParent",
        "GSI_ReportsByUser",
        "GSI_ReportsByItem",
        "GSI_LocationsByParent",
        "GSI_UsersByUid",
      ].join(", "),
    });
  }
}
