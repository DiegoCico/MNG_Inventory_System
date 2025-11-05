import {
  Stack,
  StackProps,
  CfnOutput,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as kms from "aws-cdk-lib/aws-kms";
import * as cr from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";

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

    /* =========================================================================
       KMS Key
    ========================================================================= */
    const key = new kms.Key(this, "TableKey", {
      alias: `${service}-${stage}-dynamodb-key`,
      enableKeyRotation: true,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    /* =========================================================================
       DynamoDB Table
    ========================================================================= */
    this.table = new dynamodb.Table(this, "Table", {
      tableName: `${service}-${stage}-data`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: key,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      contributorInsightsSpecification: { enabled: true },
      deletionProtection: isProd,
      timeToLiveAttribute: "ttl",
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    /* =========================================================================
       Global Secondary Indexes
    ========================================================================= */

    // Team / Workspace uniqueness by name
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_WorkspaceByName",
      partitionKey: { name: "GSI_NAME", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    // Users by Cognito UID (used by ensureUserRecord)
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_UsersByUid",
      partitionKey: { name: "GSI6PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI6SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    // Users by email (for invites / member lookup)
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_UsersByEmail",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    // Roles by name (used by role resolver)
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_RolesByName",
      partitionKey: { name: "ROLENAME", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    // User → Team mapping (for getTeamspace queries)
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_UserTeams",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING }, // USER#<userId>
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },       // TEAM#<teamId>
      projectionType: dynamodb.ProjectionType.ALL,
      contributorInsightsSpecification: { enabled: true },
    });

    const seedProvider = new cr.AwsCustomResource(this, "SeedDefaultRoles", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [`${service}-${stage}-data`]: [
              {
                PutRequest: {
                  Item: {
                    PK: { S: "ROLENAME#owner" },
                    SK: { S: "ROLE#OWNER" },
                    name: { S: "Owner" },
                    description: {
                      S: "Full control over the team and its workspaces.",
                    },
                    permissions: {
                      S: JSON.stringify([
                        "team.create",
                        "team.add_member",
                        "team.remove_member",
                        "workspace.create",
                        "workspace.delete",
                        "role.add",
                        "role.modify",
                        "role.remove",
                      ]),
                    },
                    createdAt: { S: new Date().toISOString() },
                  },
                },
              },
              {
                PutRequest: {
                  Item: {
                    PK: { S: "ROLENAME#manager" },
                    SK: { S: "ROLE#MANAGER" },
                    name: { S: "Manager" },
                    description: {
                      S: "Manage members and create workspaces.",
                    },
                    permissions: {
                      S: JSON.stringify([
                        "team.add_member",
                        "team.remove_member",
                        "workspace.create",
                      ]),
                    },
                    createdAt: { S: new Date().toISOString() },
                  },
                },
              },
              {
                PutRequest: {
                  Item: {
                    PK: { S: "ROLENAME#member" },
                    SK: { S: "ROLE#MEMBER" },
                    name: { S: "Member" },
                    description: {
                      S: "Basic access without administrative abilities.",
                    },
                    permissions: { S: JSON.stringify([]) },
                    createdAt: { S: new Date().toISOString() },
                  },
                },
              },
            ],
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of("SeedRolesOnce"),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [this.table.tableArn],
      }),
    });

    // Allow custom resource to encrypt/decrypt items
    key.grantEncryptDecrypt(seedProvider);

    // Run seeder after table creation
    seedProvider.node.addDependency(this.table);

    /* =========================================================================
        Outputs
    ========================================================================= */
    new CfnOutput(this, "TableName", { value: this.table.tableName });
    new CfnOutput(this, "TableArn", { value: this.table.tableArn });
    new CfnOutput(this, "KmsKeyArn", { value: key.keyArn });
  }
}
