import type { FastifyPluginAsync } from 'fastify';

import type { FeedbackStore } from '../../core/feedback/types.js';
import { requireJsonContentType } from '../content-type.js';
import { feedbackUnavailableError, rateLimitError, validationError, zodIssuesToDetails } from '../errors.js';
import { feedbackRequestSchema, feedbackResponseSchema } from '../schemas/feedback.js';

/** Corpo mínimo (ref + tipos + até 20 IDs de regra): 4 KB sobram. */
const FEEDBACK_BODY_LIMIT = 4 * 1024;

/**
 * POST /feedback — retorno anônimo do usuário ("Isso é golpe" / "Falso positivo").
 * Recebe só a `targetRef` opaca devolvida pelo /analyze; nada de conteúdo, IP ou cabeçalhos é armazenado ou logado.
 */
export const feedbackRoutes: FastifyPluginAsync<{ store: FeedbackStore; rateLimit: { max: number; timeWindow: number } }> = async (
  app,
  { store, rateLimit },
) => {
  app.addHook('preValidation', requireJsonContentType);

  app.post(
    '/feedback',
    {
      bodyLimit: FEEDBACK_BODY_LIMIT,
      schema: { response: { 201: feedbackResponseSchema } },
      config: { rateLimit: { ...rateLimit, errorResponseBuilder: () => rateLimitError() } },
    },
    async (request, reply) => {
      const parsed = feedbackRequestSchema.safeParse(request.body);
      if (!parsed.success) throw validationError(zodIssuesToDetails(parsed.error.issues));

      const { type, target, level, signalIds } = parsed.data;
      try {
        store.save({ type, targetType: target.type, targetRef: target.ref, level, signalIds });
      } catch {
        // Log só com o código: nada de err.message nem do corpo.
        request.log.error({ code: 'FEEDBACK_UNAVAILABLE' }, 'feedback store failed');
        throw feedbackUnavailableError();
      }

      void reply.header('Cache-Control', 'no-store');
      return reply.status(201).send({ status: 'received' });
    },
  );
};
