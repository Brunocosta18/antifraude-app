import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';

const URL_PATH = '/api/v1/analyze';
const MESSAGE = 'Reunião amanhã às 10h na sala 3.';

describe('rate limit em POST /api/v1/analyze', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(loadConfig({ NODE_ENV: 'test', RATE_LIMIT_MAX: '3' }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (payload: unknown, remoteAddress = '10.0.0.1') =>
    app.inject({ method: 'POST', url: URL_PATH, payload: payload as object, remoteAddress });

  it('conta as requisições, devolve 429 padronizado e isola por IP', async () => {
    const ok = { type: 'message', content: MESSAGE };

    for (const remaining of ['2', '1', '0']) {
      const res = await post(ok);
      expect(res.statusCode).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBe('3');
      expect(res.headers['x-ratelimit-remaining']).toBe(remaining);
    }

    const blocked = await post({ type: 'message', content: 'conteudo-sigiloso-do-usuario' });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas requisições enviadas. Tente novamente mais tarde.',
      },
    });
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body).not.toContain('conteudo-sigiloso-do-usuario');

    // Outro IP tem cota própria.
    expect((await post(ok, '10.0.0.2')).statusCode).toBe(200);

    // /health não é limitado, mesmo após o estouro.
    for (let i = 0; i < 5; i++) {
      expect((await app.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.1' })).statusCode).toBe(200);
    }
  });

  it('requisições inválidas também consomem a cota', async () => {
    const address = '10.0.0.3';
    for (let i = 0; i < 3; i++) expect((await post({ type: 'desconhecido' }, address)).statusCode).toBe(422);
    expect((await post({ type: 'message', content: MESSAGE }, address)).statusCode).toBe(429);
  });

  it('sem env, o limite padrão é 30', async () => {
    const defaultApp = await buildApp(loadConfig({ NODE_ENV: 'test' }));
    try {
      const res = await defaultApp.inject({
        method: 'POST',
        url: URL_PATH,
        payload: { type: 'message', content: MESSAGE },
      });
      expect(res.headers['x-ratelimit-limit']).toBe('30');
    } finally {
      await defaultApp.close();
    }
  });

  describe('atrás de proxy (TRUST_PROXY)', () => {
    const remaining = async (trustProxy: string, forwardedFor: string) => {
      const proxied = await buildApp(loadConfig({ NODE_ENV: 'test', TRUST_PROXY: trustProxy }));
      try {
        const send = (xff: string) =>
          proxied.inject({
            method: 'POST',
            url: URL_PATH,
            payload: { type: 'message', content: MESSAGE },
            remoteAddress: '10.9.9.9',
            headers: { 'x-forwarded-for': xff },
          });
        await send(forwardedFor);
        return (await send('203.0.113.2')).headers['x-ratelimit-remaining'];
      } finally {
        await proxied.close();
      }
    };

    it('com trustProxy=1, clientes diferentes têm contadores independentes', async () => {
      // 2º cliente (203.0.113.2) está na 1ª requisição dele: restam 29.
      expect(await remaining('1', '203.0.113.1')).toBe('29');
    });

    it('sem trustProxy, o X-Forwarded-For é ignorado e todos compartilham o contador', async () => {
      expect(await remaining('false', '203.0.113.1')).toBe('28');
    });
  });
});
