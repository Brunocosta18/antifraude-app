import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodIssue } from 'zod';

/** Erros padronizados: `{ error: { code, message, details? } }`. Nunca ecoam o conteúdo do usuário (LGPD). */

export interface ErrorDetail {
  field: string;
  issue: string;
}

/** Mensagens PT-BR fixas por código. */
const MESSAGES = {
  VALIDATION_ERROR: 'Os dados enviados são inválidos. Verifique os campos e tente novamente.',
  INVALID_URL: 'O link informado não pode ser analisado.',
  MALFORMED_JSON: 'O corpo da requisição não é um JSON válido.',
  PAYLOAD_TOO_LARGE: 'O corpo da requisição é grande demais.',
  UNSUPPORTED_MEDIA_TYPE: 'Use o tipo de conteúdo application/json.',
  RATE_LIMIT_EXCEEDED: 'Muitas requisições enviadas. Tente novamente mais tarde.',
  NOT_FOUND: 'Rota não encontrada.',
  REQUEST_ERROR: 'A requisição não pôde ser processada.',
  INTERNAL_ERROR: 'Erro interno. Tente novamente mais tarde.',
} as const;

export type ErrorCode = keyof typeof MESSAGES;

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    readonly details?: ErrorDetail[],
  ) {
    super(MESSAGES[code]);
    this.name = 'ApiError';
  }
}

export function sendError(reply: FastifyReply, statusCode: number, code: ErrorCode, details?: ErrorDetail[]): FastifyReply {
  const error = details && details.length > 0 ? { code, message: MESSAGES[code], details } : { code, message: MESSAGES[code] };
  return reply.status(statusCode).send({ error });
}

/** Só caminho e código da falha; nunca o valor recebido. */
export function zodIssuesToDetails(issues: readonly Pick<ZodIssue, 'path' | 'code'>[]): ErrorDetail[] {
  return issues.map((issue) => ({ field: issue.path.map(String).join('.') || 'body', issue: issue.code }));
}

export function validationError(details: ErrorDetail[]): ApiError {
  return new ApiError(422, 'VALIDATION_ERROR', details);
}

export function unsupportedMediaTypeError(): ApiError {
  return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE');
}

export function rateLimitError(): ApiError {
  return new ApiError(429, 'RATE_LIMIT_EXCEEDED');
}

export function invalidUrlError(reason: string): ApiError {
  return new ApiError(422, 'INVALID_URL', [{ field: 'content', issue: reason }]);
}

function isClientErrorStatus(status: unknown): status is number {
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 500;
}

export function errorHandler(error: FastifyError | ApiError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const fastifyCode = (error as FastifyError).code;
  let statusCode: number;
  let code: ErrorCode;
  let details: ErrorDetail[] | undefined;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    code = error.code;
    details = error.details;
  } else if (
    fastifyCode === 'FST_ERR_CTP_INVALID_JSON_BODY' ||
    fastifyCode === 'FST_ERR_CTP_INVALID_JSON' ||
    error instanceof SyntaxError
  ) {
    statusCode = 400;
    code = 'MALFORMED_JSON';
  } else if (fastifyCode === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
    // Corpo ausente com content-type JSON: contrato violado, não sintaxe inválida.
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    details = [{ field: 'body', issue: 'required' }];
  } else if (fastifyCode === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
  } else if (fastifyCode === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    statusCode = 415;
    code = 'UNSUPPORTED_MEDIA_TYPE';
  } else if (isClientErrorStatus((error as FastifyError).statusCode)) {
    // Demais erros de cliente do Fastify (ex.: Content-Length inválido) mantêm o status original.
    statusCode = (error as FastifyError).statusCode as number;
    code = 'REQUEST_ERROR';
  } else {
    statusCode = 500;
    code = 'INTERNAL_ERROR';
  }

  // Log mínimo: nada de err.message (o parser pode citar trechos do corpo). Nome e código bastam para depurar.
  const logEntry = { code, statusCode, errorName: error.name, fastifyCode };
  if (statusCode >= 500) request.log.error(logEntry, 'request failed');
  else request.log.warn(logEntry, 'request failed');
  return sendError(reply, statusCode, code, details);
}

export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return sendError(reply, 404, 'NOT_FOUND');
}
