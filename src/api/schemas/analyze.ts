import { z } from 'zod';

import { DEFAULT_TEXT_MAX_LENGTH } from '../../utils/text.js';
import { DEFAULT_URL_MAX_LENGTH } from '../../utils/url.js';

/** Corpo de `POST /api/v1/analyze`. Ramos estritos: campos extras são rejeitados. */
export const analyzeRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), content: z.string().trim().min(1).max(DEFAULT_TEXT_MAX_LENGTH) }).strict(),
  z.object({ type: z.literal('url'), content: z.string().trim().min(1).max(DEFAULT_URL_MAX_LENGTH) }).strict(),
]);

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

const signalSchema = {
  type: 'object',
  required: ['id', 'category', 'severity', 'weight', 'title', 'explanation', 'advice'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    category: {
      type: 'string',
      enum: [
        'easy_money',
        'fake_billing',
        'urgency',
        'credential_request',
        'impersonation',
        'payment_pressure',
        'fake_prize',
        'fake_job',
        'domain',
        'url_structure',
      ],
    },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    weight: { type: 'number' },
    title: { type: 'string' },
    explanation: { type: 'string' },
    advice: { type: 'string' },
  },
} as const;

/** Resposta 200. `additionalProperties: false` faz o serializador descartar qualquer campo inesperado. */
export const analyzeResponseSchema = {
  type: 'object',
  required: ['type', 'report'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['message', 'url'] },
    report: {
      type: 'object',
      required: ['level', 'label', 'score', 'signals', 'advice', 'disclaimer'],
      additionalProperties: false,
      properties: {
        level: { type: 'string', enum: ['HIGH_RISK', 'NEEDS_ATTENTION', 'NO_KNOWN_INDICATORS'] },
        label: { type: 'string' },
        score: { type: 'number', minimum: 0, maximum: 100 },
        signals: { type: 'array', items: signalSchema },
        advice: { type: 'array', items: { type: 'string' } },
        disclaimer: { type: 'string' },
      },
    },
  },
} as const;
