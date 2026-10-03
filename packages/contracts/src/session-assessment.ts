import { z } from 'zod';

/** A short closed-book retrieval exercise. A connection may also be an honest question. */
export const SESSION_RECALL_FIELD_MAX_LENGTH = 600;
export const sessionRecallSchema = z.object({
  idea: z.string().trim().max(SESSION_RECALL_FIELD_MAX_LENGTH),
  detail: z.string().trim().max(SESSION_RECALL_FIELD_MAX_LENGTH),
  connection: z.string().trim().max(SESSION_RECALL_FIELD_MAX_LENGTH),
});
export type SessionRecall = z.infer<typeof sessionRecallSchema>;

export const sessionAssessmentSchema = z.object({
  version: z.literal('bubo-recall-v1'),
  passed: z.boolean(),
  /** Checklist completion, never factual accuracy, understanding or a retention percentage. */
  score: z.number().int().min(0).max(100),
  kind: z.literal('writing_checklist'),
  factualVerification: z.literal('unavailable'),
  checks: z.array(
    z.object({
      key: z.enum(['idea', 'detail', 'connection', 'originality']),
      passed: z.boolean(),
      message: z.string(),
    }),
  ),
  feedback: z.string(),
});
export type SessionAssessment = z.infer<typeof sessionAssessmentSchema>;

export const assessSessionRequestSchema = z.object({
  shelfEntryId: z.string().min(1),
  recall: sessionRecallSchema,
  /** Explicit consent to send only this exercise to Gemini for a follow-up question. */
  coach: z.boolean().default(false),
});
export type AssessSessionRequest = z.input<typeof assessSessionRequestSchema>;

export const assessSessionResponseSchema = z.object({
  assessment: sessionAssessmentSchema,
  coach: z.object({
    status: z.enum(['not_requested', 'available', 'unavailable']),
    question: z.string().max(240).nullable(),
  }),
});
export type AssessSessionResponse = z.infer<typeof assessSessionResponseSchema>;
