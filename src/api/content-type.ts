import type { FastifyRequest } from 'fastify';

import { unsupportedMediaTypeError } from './errors.js';

/** Fastify aceita text/plain por padrão; aqui só JSON é aceito (sem Content-Type = corpo ausente → 422). */
const JSON_CONTENT_TYPE = /^application\/(?:[\w.+-]+\+)?json\s*(?:;|$)/i;

/** Hook `preValidation` compartilhado pelas rotas que recebem JSON. */
export async function requireJsonContentType(request: FastifyRequest): Promise<void> {
  const contentType = request.headers['content-type'];
  if (contentType !== undefined && !JSON_CONTENT_TYPE.test(contentType)) throw unsupportedMediaTypeError();
}
