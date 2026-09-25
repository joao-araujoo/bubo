import { z } from 'zod';

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ScoreConfidenceSchema = z.enum(['insufficient', 'low', 'medium', 'high']);
export type ScoreConfidence = z.infer<typeof ScoreConfidenceSchema>;
