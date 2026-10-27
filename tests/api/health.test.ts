import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';

const ALLOWED_ORIGIN = 'http://localhost:8081';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(loadConfig({ NODE_ENV: 'test', CORS_ORIGIN: ALLOWED_ORIGIN }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 com o status do serviço', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);

    const body = res.json();
    expect(body).toEqual({
      status: 'ok',
      service: 'antifraude-api',
      version: expect.any(String),
      uptimeSeconds: expect.any(Number),
      timestamp: expect.any(String),
    });
    expect(Number.isInteger(body.uptimeSeconds)).toBe(true);
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('inclui cabeçalhos de segurança (helmet)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('libera CORS para origem permitida', async () => {
    const res = await app.inject({ method: 'GET', url: '/health', headers: { origin: ALLOWED_ORIGIN } });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('responde ao preflight OPTIONS de origem permitida', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'GET' },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-methods']).toContain('GET');
  });

  it('não libera CORS para origem não permitida', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://site-malicioso.xyz' },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('retorna 404 para rota inexistente', async () => {
    const res = await app.inject({ method: 'GET', url: '/nao-existe' });

    expect(res.statusCode).toBe(404);
  });
});

describe('CORS com curinga (desenvolvimento)', () => {
  it('reflete qualquer origem quando CORS_ORIGIN="*"', async () => {
    const app = await buildApp(loadConfig({ NODE_ENV: 'test', CORS_ORIGIN: '*' }));
    try {
      const res = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://192.168.0.10:19006' } });
      expect(res.headers['access-control-allow-origin']).toBe('http://192.168.0.10:19006');
    } finally {
      await app.close();
    }
  });
});
