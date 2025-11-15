import { z } from 'zod';
import { protectedProcedure, router } from './trpc';
import { lambdaClient } from '../aws';
import { InvokeCommand } from '@aws-sdk/client-lambda';

const DA2404_LAMBDA_NAME = process.env.DA2404_LAMBDA_NAME ?? 'mng-da2404-stamper-dev';

export const formsRouter = router({
  generateDa2404: protectedProcedure
    .input(
      z.object({
        organization: z.string(),
        nomenclature: z.string(),
        model: z.string(),
        serial: z.string(),
        inspectionType: z.string(),
        date: z.string().optional(),
        miles: z.string().optional(),
        hours: z.string().optional(),
        rounds: z.string().optional(),
        hotstarts: z.string().optional(),
        saveToS3: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.teamId) {
        throw new Error('Unauthorized: Missing team');
      }

      const teamId = ctx.user.teamId;

      const eventPayload = {
        requestContext: {
          http: { method: 'POST' },
        },
        isBase64Encoded: false,
        body: JSON.stringify({
          ...input,
          teamId,
        }),
      };

      const invokeRes = await lambdaClient.send(
        new InvokeCommand({
          FunctionName: DA2404_LAMBDA_NAME,
          Payload: Buffer.from(JSON.stringify(eventPayload)),
        }),
      );

      if (!invokeRes.Payload) {
        throw new Error('Lambda returned no payload');
      }

      const decoded = new TextDecoder().decode(invokeRes.Payload);
      const lambdaResponse = JSON.parse(decoded);

      if (lambdaResponse.statusCode !== 200) {
        let errorMsg = lambdaResponse.body;
        try {
          errorMsg = JSON.parse(errorMsg);
        } catch {
          /* ignore */
        }
        throw new Error(`DA2404 Lambda error: ${errorMsg?.error ?? JSON.stringify(errorMsg)}`);
      }

      let parsedBody: any = lambdaResponse.body;
      try {
        parsedBody = typeof parsedBody === 'string' ? JSON.parse(parsedBody) : parsedBody;
      } catch {}

      return {
        statusCode: lambdaResponse.statusCode,
        isBase64Encoded: lambdaResponse.isBase64Encoded ?? false,
        headers: lambdaResponse.headers ?? {},
        body: parsedBody,
      };
    }),
});
