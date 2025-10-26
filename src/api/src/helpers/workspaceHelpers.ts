import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { ddb } from "../aws"

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'mng-dev-data';


/**
 * Get all the child items that belong to parent item
 * 
 * @param parentItemId - The ID of the parent item
 * @returns Array of child items
 */
export const getItemsByParent = async (params: { parentItemId: string }) => {
    const { parentItemId } = params;
    const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI_ItemsByParent',
        KeyConditionExpression: 'GSI2PK = :parentKey',
        ExpressionAttributeValues: {
            ':parentKey': {S: `PARENT#${parentItemId}`}
        }
    });
    try {
        const result = await ddb.send(command);

        return result.Items || [];
    } catch (error) {
        console.error('Error fetching items by parent: ', error);
        throw new Error('Failed to fetch child items');
    }
};

// getItemsByProfile

// getLocationsByParent

// getReportsByItem

// getReportsByUser


/**
 * Look up a user by their Cognito ID
 * 
 * @param uid - Cognito user ID from JWT Token
 * @returns User object or null if not found
 */
export const getUserByUid = async (params: { uid: string }) => {
    const { uid } = params;

    const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI_UsersByUid',
        KeyConditionExpression: 'GSI6PK = :uidKey',
        ExpressionAttributeValues: {
            ':uidKey': { S: `UID#${uid}` }
        },
        Limit: 1,
    });

    try {
        const result = await ddb.send(command);

        if (!result.Items || result.Items.length === 0) {
            return null;
        }
        return result.Items[0];
    } catch (error) {
        console.error('Error fetching user by UID: ', error);
        throw new Error('Failed to fetch user')
    }
};