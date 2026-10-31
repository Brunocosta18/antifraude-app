import type { FastifyPluginAsync } from 'fastify';

import { analyzeMessageWithFeed, analyzeUrlWithFeed } from '../../core/analyzer.js';
import { computeTargetRef } from '../../core/feedback/target-ref.js';
import type { AnalyzeType, MetricsCounter } from '../../core/metrics/counter.js';
import type { AnalysisReport, ThreatFeed } from '../../core/types.js';
import { requireJsonContentType } from '../content-type.js';
import { invalidUrlError, rateLimitError, validationError, zodIssuesToDetails } from '../errors.js';
import { analyzeRequestSchema, analyzeResponseSchema } from '../schemas/analyze.js';

/** Limite do corpo: 5000 caracteres de mensagem cabem com folga (UTF-8 + JSON). */
const ANALYZE_BODY_LIMIT = 32 * 1024;

/**
 * POST /analyze — análise local somada ao `ThreatFeed` (só o hostname sai; falha → resultado local).
 * O conteúdo enviado nunca é devolvido, logado nem armazenado.
 */
export const analyzeRoutes: FastifyPluginAsync<{
  threatFeed: ThreatFeed;
  feedbackSecret: string;
  metrics: MetricsCounter;
  rateLimit: { max: number; timeWindow: number };
}> = async (app, { threatFeed, feedbackSecret, metrics, rateLimit }) => {
  /** Contagem agregada (só nível e categorias). Uma falha de métricas nunca derruba a análise. */
  const record = (type: AnalyzeType, report: AnalysisReport): void => {
    try {
      metrics.record(type, report);
    } catch {
      // silencioso de propósito
    }
  };

  app.addHook('preValidation', requireJsonContentType);

  app.post(
    '/analyze',
    {
      bodyLimit: ANALYZE_BODY_LIMIT,
      schema: { response: { 200: analyzeResponseSchema } },
      // Por IP, em memória; o 429 sai pelo errorHandler no formato padrão.
      config: { rateLimit: { ...rateLimit, errorResponseBuilder: () => rateLimitError() } },
    },
    async (request, reply) => {
      const parsed = analyzeRequestSchema.safeParse(request.body);
      if (!parsed.success) throw validationError(zodIssuesToDetails(parsed.error.issues));

      const { type, content } = parsed.data;
      void reply.header('Cache-Control', 'no-store');

      if (type === 'message') {
        const report = await analyzeMessageWithFeed(content, threatFeed);
        record(type, report);
        return { type, targetRef: computeTargetRef(feedbackSecret, type, content), report };
      }

      const result = await analyzeUrlWithFeed(content, threatFeed);
      if (!result.ok) throw invalidUrlError(result.reason);
      record(type, result.value);
      return { type, targetRef: computeTargetRef(feedbackSecret, type, content), report: result.value };
    },
  );
};
