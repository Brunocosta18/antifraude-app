import type { FastifyPluginAsync } from 'fastify';

import type { FeedbackStore, FeedbackSummary } from '../../core/feedback/types.js';
import { RISK_LEVELS, SIGNAL_CATEGORIES, type AnalysisMetrics, type MetricsCounter } from '../../core/metrics/counter.js';
import { rateLimitError } from '../errors.js';

export interface MetricsRouteOptions {
  counter: MetricsCounter;
  feedbackStore: FeedbackStore;
  cacheTtlMs: number;
  now: () => number;
  rateLimit: { max: number; timeWindow: number };
}

const counts = (keys: readonly string[]) =>
  ({
    type: 'object',
    required: [...keys],
    additionalProperties: false,
    properties: Object.fromEntries(keys.map((key) => [key, { type: 'integer', minimum: 0 }])),
  }) as const;

const metricsResponseSchema = {
  type: 'object',
  required: ['since', 'generatedAt', 'analyses', 'levels', 'categories', 'feedback'],
  additionalProperties: false,
  properties: {
    since: { type: 'string' },
    generatedAt: { type: 'string' },
    analyses: {
      type: 'object',
      required: ['total', 'byType'],
      additionalProperties: false,
      properties: { total: { type: 'integer', minimum: 0 }, byType: counts(['message', 'url']) },
    },
    levels: counts(RISK_LEVELS),
    categories: counts(SIGNAL_CATEGORIES),
    feedback: counts(['scamReports', 'falsePositives']),
  },
} as const;

type MetricsBody = AnalysisMetrics & { generatedAt: string; feedback: FeedbackSummary };

/**
 * GET /metrics — painel de ameaças anônimo: só contagens inteiras agregadas em memória (ANTIGOL-018).
 * Resposta em cache por `cacheTtlMs`; se o armazenamento de feedback falhar, o feedback volta zerado.
 */
export const metricsRoutes: FastifyPluginAsync<MetricsRouteOptions> = async (
  app,
  { counter, feedbackStore, cacheTtlMs, now, rateLimit },
) => {
  let cache: { body: MetricsBody; expiresAt: number } | null = null;

  app.get(
    '/metrics',
    {
      schema: { response: { 200: metricsResponseSchema } },
      config: { rateLimit: { ...rateLimit, errorResponseBuilder: () => rateLimitError() } },
    },
    async (request, reply) => {
      void reply.header('Cache-Control', `public, max-age=${Math.floor(cacheTtlMs / 1000)}`);

      const current = now();
      if (cache !== null && current < cache.expiresAt) return cache.body;

      let feedback: FeedbackSummary = { scamReports: 0, falsePositives: 0 };
      try {
        feedback = feedbackStore.totals();
      } catch {
        // Log só com o código: nada de err.message.
        request.log.error({ code: 'FEEDBACK_UNAVAILABLE' }, 'feedback totals failed');
      }

      const body: MetricsBody = { ...counter.snapshot(), generatedAt: new Date(current).toISOString(), feedback };
      cache = { body, expiresAt: current + cacheTtlMs };
      return body;
    },
  );
};
