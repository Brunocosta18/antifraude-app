import type { FastifyPluginAsync } from 'fastify';

import { analyzeMessage, analyzeUrl } from '../../core/analyzer.js';
import { invalidUrlError, unsupportedMediaTypeError, validationError, zodIssuesToDetails } from '../errors.js';
import { analyzeRequestSchema, analyzeResponseSchema } from '../schemas/analyze.js';

/** Limite do corpo: 5000 caracteres de mensagem cabem com folga (UTF-8 + JSON). */
const ANALYZE_BODY_LIMIT = 32 * 1024;

/** Fastify aceita text/plain por padrão; aqui só JSON é aceito (sem Content-Type = corpo ausente → 422). */
const JSON_CONTENT_TYPE = /^application\/(?:[\w.+-]+\+)?json\s*(?:;|$)/i;

/**
 * POST /analyze — análise local e síncrona (sem rede). O conteúdo enviado nunca é devolvido,
 * logado nem armazenado. Quando houver adaptadores externos, usar `assertPublicDestination`.
 */
export const analyzeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preValidation', async (request) => {
    const contentType = request.headers['content-type'];
    if (contentType !== undefined && !JSON_CONTENT_TYPE.test(contentType)) throw unsupportedMediaTypeError();
  });

  app.post(
    '/analyze',
    { bodyLimit: ANALYZE_BODY_LIMIT, schema: { response: { 200: analyzeResponseSchema } } },
    async (request, reply) => {
      const parsed = analyzeRequestSchema.safeParse(request.body);
      if (!parsed.success) throw validationError(zodIssuesToDetails(parsed.error.issues));

      const { type, content } = parsed.data;
      void reply.header('Cache-Control', 'no-store');

      if (type === 'message') return { type, report: analyzeMessage(content) };

      const result = analyzeUrl(content);
      if (!result.ok) throw invalidUrlError(result.reason);
      return { type, report: result.value };
    },
  );
};
