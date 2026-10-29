import { z } from 'zod';

/** Corpo de `POST /api/v1/feedback`. Só referência opaca + nível + IDs de regra: nunca o conteúdo analisado. */
export const feedbackRequestSchema = z
  .object({
    type: z.enum(['SCAM_REPORT', 'FALSE_POSITIVE']),
    target: z.object({ type: z.enum(['message', 'url']), ref: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    level: z.enum(['HIGH_RISK', 'NEEDS_ATTENTION', 'NO_KNOWN_INDICATORS']),
    signalIds: z.array(z.string().regex(/^[A-Z0-9-]{1,40}$/)).max(20).default([]),
  })
  .strict();

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

export const feedbackResponseSchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: { status: { type: 'string', enum: ['received'] } },
} as const;
