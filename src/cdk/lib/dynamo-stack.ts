import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cr from 'aws-cdk-lib/custom-resources';

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

    const key = new kms.Key(this, 'TableKey', {
      alias: `${service}-${stage}-dynamodb-key`,
      enableKeyRotation: true,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // MAIN TABLE
    this.table = new dynamodb.Table(this, 'Table', {
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
      indexName: 'GSI_UsersByUsername',
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI_RolesByName',
      partitionKey: { name: 'ROLENAME', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI_UserTeams',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
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
                    PK: { S: 'ROLE#OWNER' },
                    SK: { S: 'METADATA' },
                    roleId: { S: 'OWNER' },
                    name: { S: 'Owner' },
                    description: {
                      S: 'Full administrative control over the system.',
                    },
                    permissions: {
                      L: [
                        { S: 'team.create' },
                        { S: 'team.add_member' },
                        { S: 'team.remove_member' },
                        { S: 'team.view' },
                        { S: 'team.delete' },
                        { S: 'user.invite' },
                        { S: 'user.delete' },
                        { S: 'user.assign_roles' },
                        { S: 'role.add' },
                        { S: 'role.modify' },
                        { S: 'role.remove' },
                        { S: 'role.view' },
                        { S: 'item.create' },
                        { S: 'item.view' },
                        { S: 'item.update' },
                        { S: 'item.delete' },
                        { S: 'item.reset' },
                        { S: 'reports.create' },
                        { S: 'reports.view' },
                        { S: 'reports.delete' },
                      ],
                    },
                    createdAt: { S: new Date().toISOString() },
                    updatedAt: { S: new Date().toISOString() },
                  },
                },
              },

              // MANAGER
              {
                PutRequest: {
                  Item: {
                    PK: { S: 'ROLE#MANAGER' },
                    SK: { S: 'METADATA' },
                    roleId: { S: 'MANAGER' },
                    name: { S: 'Manager' },
                    description: {
                      S: 'Manage members, items, and reports.',
                    },
                    permissions: {
                      L: [
                        { S: 'team.create' },
                        { S: 'team.add_member' },
                        { S: 'team.remove_member' },
                        { S: 'team.view' },
                        { S: 'item.create' },
                        { S: 'item.view' },
                        { S: 'item.update' },
                        { S: 'reports.create' },
                        { S: 'reports.view' },
                      ],
                    },
                    createdAt: { S: new Date().toISOString() },
                    updatedAt: { S: new Date().toISOString() },
                  },
                },
              },

              // MEMBER
              {
                PutRequest: {
                  Item: {
                    PK: { S: 'ROLE#MEMBER' },
                    SK: { S: 'METADATA' },
                    roleId: { S: 'MEMBER' },
                    name: { S: 'Member' },
                    description: {
                      S: 'Limited access to view and report items.',
                    },
                    permissions: {
                      L: [
                        { S: 'item.view' },
                        { S: 'reports.create' },
                        { S: 'reports.view' },
                        { S: 'team.view' },
                      ],
                    },
                    createdAt: { S: new Date().toISOString() },
                    updatedAt: { S: new Date().toISOString() },
                  },
                },
              },
            ],
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('SeedRoles-v4'),
      },
      onUpdate: {
        service: 'DynamoDB',
        action: 'batchWriteItem',
        parameters: {
          RequestItems: {
            [`${service}-${stage}-data`]: [
              {
                PutRequest: {
                  Item: {
                    PK: { S: 'ROLE#OWNER' },
                    SK: { S: 'METADATA' },
                    roleId: { S: 'OWNER' },
                    name: { S: 'Owner' },
                    description: { S: 'Full administrative control over the system.' },
                    permissions: {
                      L: [
                        { S: 'team.create' },
                        { S: 'team.add_member' },
                        { S: 'team.remove_member' },
                        { S: 'team.view' },
                        { S: 'team.delete' },
                        { S: 'user.invite' },
                        { S: 'user.delete' },
                        { S: 'user.assign_roles' },
                        { S: 'role.add' },
                        { S: 'role.modify' },
                        { S: 'role.remove' },
                        { S: 'role.view' },
                        { S: 'item.create' },
                        { S: 'item.view' },
                        { S: 'item.update' },
                        { S: 'item.delete' },
                        { S: 'item.reset' },
                        { S: 'reports.create' },
                        { S: 'reports.view' },
                        { S: 'reports.delete' },
                      ],
                    },
                    createdAt: { S: new Date().toISOString() },
                    updatedAt: { S: new Date().toISOString() },
                  },
                },
              },
              {
                PutRequest: {
                  Item: {
                    PK: { S: 'ROLE#MANAGER' },
                    SK: { S: 'METADATA' },
                    roleId: { S: 'MANAGER' },
                    name: { S: 'Manager' },
                    description: { S: 'Manage members, items, and reports.' },
                    permissions: {
                      L: [
                        { S: 'team.create' },
                        { S: 'team.add_member' },
                        { S: 'team.remove_member' },
                        { S: 'team.view' },
                        { S: 'item.create' },
                        { S: 'item.view' },
                        { S: 'item.update' },
                        { S: 'reports.create' },
                        { S: 'reports.view' },
                      ],
                    },
                    createdAt: { S: new Date().toISOString() },
                    updatedAt: { S: new Date().toISOString() },
                  },
                },
              },
              {
                PutRequest: {
                  Item: {
                    PK: { S: 'ROLE#MEMBER' },
                    SK: { S: 'METADATA' },
                    roleId: { S: 'MEMBER' },
                    name: { S: 'Member' },
                    description: { S: 'Limited access to view and report items.' },
                    permissions: {
                      L: [
                        { S: 'item.view' },
                        { S: 'reports.create' },
                        { S: 'reports.view' },
                        { S: 'team.view' },
                      ],
                    },
                    createdAt: { S: new Date().toISOString() },
                    updatedAt: { S: new Date().toISOString() },
                  },
                },
              },
            ],
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('SeedRoles-v4'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [this.table.tableArn],
      }),
    });

    key.grantEncryptDecrypt(seedProvider);
    seedProvider.node.addDependency(this.table);

    new CfnOutput(this, 'TableName', { value: this.table.tableName });
    new CfnOutput(this, 'TableArn', { value: this.table.tableArn });
    new CfnOutput(this, 'KmsKeyArn', { value: key.keyArn });
  }
}
