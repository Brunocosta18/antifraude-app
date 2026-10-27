import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, errorHandler } from '../../../src/api/errors.js';

const SENSITIVE = 'cpf 123.456.789-09 chave pix';

function fakeContext() {
  const log = { warn: vi.fn(), error: vi.fn() };
  const reply = {
    statusCode: 0,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
  return { log, reply, request: { log } as unknown as FastifyRequest };
}

function fastifyError(props: Partial<FastifyError>): FastifyError {
  return Object.assign(new Error(SENSITIVE), props) as FastifyError;
}

describe('errorHandler', () => {
  it('mantém o status de erros 4xx do Fastify não mapeados', () => {
    const { reply, request, log } = fakeContext();
    errorHandler(fastifyError({ code: 'FST_ERR_CTP_INVALID_CONTENT_LENGTH', statusCode: 400 }), request, reply as unknown as FastifyReply);

    expect(reply.statusCode).toBe(400);
    expect(reply.payload).toEqual({ error: { code: 'REQUEST_ERROR', message: expect.any(String) } });
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('erro sem status 4xx vira 500 INTERNAL_ERROR e é logado como error', () => {
    const { reply, request, log } = fakeContext();
    errorHandler(new TypeError(SENSITIVE) as FastifyError, request, reply as unknown as FastifyReply);

    expect(reply.statusCode).toBe(500);
    expect(reply.payload).toEqual({ error: { code: 'INTERNAL_ERROR', message: expect.any(String) } });
    expect(log.error).toHaveBeenCalledWith(
      { code: 'INTERNAL_ERROR', statusCode: 500, errorName: 'TypeError', fastifyCode: undefined },
      'request failed',
    );
  });

  it('status 5xx informado pelo erro também vira 500 genérico', () => {
    const { reply, request } = fakeContext();
    errorHandler(fastifyError({ code: 'FST_ERR_X', statusCode: 503 }), request, reply as unknown as FastifyReply);

    expect(reply.statusCode).toBe(500);
  });

  it('log inclui nome e código do erro, mas nunca a mensagem', () => {
    const { reply, request, log } = fakeContext();
    errorHandler(fastifyError({ name: 'FastifyError', code: 'FST_ERR_CTP_INVALID_CONTENT_LENGTH', statusCode: 400 }), request, reply as unknown as FastifyReply);

    const [entry] = log.warn.mock.calls[0] ?? [];
    expect(entry).toMatchObject({ errorName: 'FastifyError', fastifyCode: 'FST_ERR_CTP_INVALID_CONTENT_LENGTH' });
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain(SENSITIVE);
    expect(JSON.stringify(reply.payload)).not.toContain(SENSITIVE);
  });

  it('ApiError mantém status e código próprios', () => {
    const { reply, request } = fakeContext();
    errorHandler(new ApiError(422, 'VALIDATION_ERROR', [{ field: 'content', issue: 'too_big' }]), request, reply as unknown as FastifyReply);

    expect(reply.statusCode).toBe(422);
    expect(reply.payload).toMatchObject({ error: { code: 'VALIDATION_ERROR', details: [{ field: 'content', issue: 'too_big' }] } });
  });
});
