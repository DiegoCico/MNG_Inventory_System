import { z } from 'zod';
import { router, permissionedProcedure } from './trpc';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { loadConfig } from '../process';

const config = loadConfig();
const REGION = config.REGION;

const lambda = new LambdaClient({ region: REGION });

/**
 * Invoke a Python Lambda function
 */
async function invokePythonLambda(functionName: string, teamId: string) {
  console.log(`[invokePythonLambda] Invoking ${functionName} for teamId: ${teamId}`);
  
  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({ teamId }),
    });
    
    const response = await lambda.send(command);
    
    if (!response.Payload) {
      throw new Error(`No payload returned from ${functionName}`);
    }
    
    const payloadString = new TextDecoder().decode(response.Payload);
    console.log(`[invokePythonLambda] ${functionName} response preview:`, payloadString.substring(0, 200));
    
    const result = JSON.parse(payloadString);
    
    // Check for Lambda execution errors
    if (response.FunctionError) {
      console.error(`[invokePythonLambda] ${functionName} function error:`, result);
      throw new Error(`Lambda error in ${functionName}: ${result.errorMessage || 'Unknown error'}`);
    }
    
    // Parse the body if it's wrapped in statusCode/body format
    if (result.statusCode && result.body) {
      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      console.log(`[invokePythonLambda] ${functionName} body.ok=${body.ok}`);
      return body;
    }
    
    // Direct return (for testing)
    console.log(`[invokePythonLambda] ${functionName} direct result.ok=${result.ok}`);
    return result;
    
  } catch (err: any) {
    console.error(`[invokePythonLambda] ${functionName} error:`, err);
    throw new Error(`Failed to invoke ${functionName}: ${err.message}`);
  }
}

/**
 * Main export function - invokes both Python Lambdas
 */
export async function runExport(teamId: string) {
  console.log('[runExport] Starting export for teamId:', teamId);
  
  // Get function names from environment variables (set by CDK)
  const pdf2404FunctionName = process.env.EXPORT_2404_FUNCTION_NAME;
  const inventoryFunctionName = process.env.EXPORT_INVENTORY_FUNCTION_NAME;
  
  if (!pdf2404FunctionName || !inventoryFunctionName) {
    const error = 'Export function names not configured. Check CDK deployment.';
    console.error('[runExport]', error);
    throw new Error(error);
  }
  
  console.log('[runExport] Using functions:', {
    pdf2404: pdf2404FunctionName,
    inventory: inventoryFunctionName
  });
  
  try {
    // Invoke both Lambda functions in parallel
    console.log('[runExport] Invoking Lambda functions in parallel...');
    const [pdf2404Response, csvResponse] = await Promise.all([
      invokePythonLambda(pdf2404FunctionName, teamId),
      invokePythonLambda(inventoryFunctionName, teamId),
    ]);
    
    console.log('[runExport] PDF response ok:', pdf2404Response?.ok);
    console.log('[runExport] CSV response ok:', csvResponse?.ok);
    console.log('[runExport] PDF has URL:', !!pdf2404Response?.url);
    console.log('[runExport] CSV has URL:', !!csvResponse?.url);
    
    // At least ONE export must succeed (not both required)
    if (!pdf2404Response?.ok && !csvResponse?.ok) {
      throw new Error('Both export operations failed');
    }
    
    console.log('[runExport] Export completed successfully');
    
    return {
      success: true,
      pdf2404: pdf2404Response,
      csvInventory: csvResponse,
    };
    
  } catch (err: any) {
    console.error('[runExport] Export failed:', err);
    throw err;
  }
}

// TRPC Router
export const exportRouter = router({
  getExport: permissionedProcedure('reports.create')
    .input(z.object({ teamId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        console.log('[getExport] Starting export for teamId:', input.teamId);
        const result = await runExport(input.teamId);
        console.log('[getExport] Export completed successfully');
        return result;
      } catch (err: any) {
        console.error('[getExport] Export failed:', err);
        return {
          success: false,
          error: err.message || 'Failed to run export.',
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        };
      }
    }),
});