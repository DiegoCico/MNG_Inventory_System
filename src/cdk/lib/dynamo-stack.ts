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

export interface DynamoStackProps extends StackProps {
  stage: string;
  serviceName?: string;
}

export class DynamoStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoStackProps) {
    super(scope, id, props);

    const service = (props.serviceName ?? 'mng').toLowerCase();
    const stage = props.stage.toLowerCase();
    const isProd = stage === 'prod';

    const key = new kms.Key(this, "TableKey", {
      alias: `${service}-${stage}-dynamodb-key`,
      enableKeyRotation: true,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // MAIN TABLE
    this.table = new dynamodb.Table(this, "Table", {
      tableName: `${service}-${stage}-data`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: key,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      contributorInsightsSpecification: { enabled: true },
      deletionProtection: isProd,
      timeToLiveAttribute: 'ttl',
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    /* ============================================================
       GLOBAL SECONDARY INDEXES
    ============================================================ */

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI_WorkspaceByName',
      partitionKey: { name: 'GSI_NAME', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI_UsersByUid',
      partitionKey: { name: 'GSI6PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI6SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 🔥 UNIQUE USERNAME INDEX
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_UsersByUsername",
      partitionKey: { name: "username", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI_RolesByName',
      partitionKey: { name: 'ROLENAME', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_UserTeams",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    /* ============================================================
       DEFAULT ROLE SEEDER
    ============================================================ */

    const seedProvider = new cr.AwsCustomResource(this, 'SeedDefaultRoles', {
      onCreate: {
        service: 'DynamoDB',
        action: 'batchWriteItem',
        parameters: {
          RequestItems: {
            [`${service}-${stage}-data`]: [
              // OWNER
              {
                PutRequest: {
                  Item: {
                    PK: { S: 'ROLENAME#owner' },
                    SK: { S: 'ROLE#OWNER' },
                    name: { S: 'Owner' },
                    description: {
                      S: "Full administrative control over the system.",
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
                        "role.view",
                        "item.create",
                        "item.update",
                        "item.delete",
                        "item.view",
                        "item.upload_image",
                        "item.manage_damage",
                        "damage.create",
                        "damage.update",
                        "damage.delete",
                        "damage.view",
                        "s3.upload",
                        "s3.delete",
                        "s3.view",
                        "log.view",
                        "log.export",
                      ]),
                    },
                    createdAt: { S: new Date().toISOString() },
                  },
                },
              },

              // MANAGER
              {
                PutRequest: {
                  Item: {
                    PK: { S: 'ROLENAME#manager' },
                    SK: { S: 'ROLE#MANAGER' },
                    name: { S: 'Manager' },
                    description: {
                      S: "Manage members, items, and reports.",
                    },
                    permissions: {
                      S: JSON.stringify([
                        "team.add_member",
                        "team.remove_member",
                        "workspace.create",
                        "item.create",
                        "item.view",
                        "item.update",
                        "damage.create",
                        "damage.view",
                        "s3.upload",
                      ]),
                    },
                    createdAt: { S: new Date().toISOString() },
                  },
                },
              },

              // MEMBER
              {
                PutRequest: {
                  Item: {
                    PK: { S: 'ROLENAME#member' },
                    SK: { S: 'ROLE#MEMBER' },
                    name: { S: 'Member' },
                    description: {
                      S: "Limited access to view and report items.",
                    },
                    permissions: {
                      S: JSON.stringify(["item.view", "damage.create", "damage.view"]),
                    },
                    createdAt: { S: new Date().toISOString() },
                  },
                },
              },
            ],
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('SeedRolesOnce'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [this.table.tableArn],
      }),
    });

    key.grantEncryptDecrypt(seedProvider);
    seedProvider.node.addDependency(this.table);

    new CfnOutput(this, "TableName", { value: this.table.tableName });
    new CfnOutput(this, "TableArn", { value: this.table.tableArn });
    new CfnOutput(this, "KmsKeyArn", { value: key.keyArn });
  }
}
