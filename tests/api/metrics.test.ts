import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { createSqliteFeedbackStore } from '../../src/adapters/sqlite-feedback-store.js';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import type { FeedbackStore } from '../../src/core/feedback/types.js';

const URL_PATH = '/api/v1/metrics';
const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
const SCAM_TEXT = 'Urgente! Ganhe dinheiro fácil, faça um pix de 50 reais hoje para liberar seu prêmio';

describe('GET /api/v1/metrics', () => {
  let app: FastifyInstance;

  async function setup(
    env: Record<string, string> = {},
    deps: { feedbackStore?: FeedbackStore; now?: () => number } = {},
  ): Promise<void> {
    app = await buildApp(
      loadConfig({ NODE_ENV: 'test', RATE_LIMIT_MAX: '10000', FEEDBACK_HMAC_SECRET: SECRET, ...env }),
      deps,
    );
    await app.ready();
  }

  afterEach(async () => {
    await app.close();
  });

  const get = (remoteAddress?: string) => app.inject({ method: 'GET', url: URL_PATH, remoteAddress });
  const analyze = (type: 'message' | 'url', content: string) =>
    app.inject({ method: 'POST', url: '/api/v1/analyze', payload: { type, content } });

  it('estado inicial zerado, com since só com data', async () => {
    await setup();
    const res = await get();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.analyses).toEqual({ total: 0, byType: { message: 0, url: 0 } });
    expect(body.levels).toEqual({ HIGH_RISK: 0, NEEDS_ATTENTION: 0, NO_KNOWN_INDICATORS: 0 });
    expect(Object.keys(body.categories)).toHaveLength(11);
    expect(body.feedback).toEqual({ scamReports: 0, falsePositives: 0 });
  });

  it('reflete as análises feitas', async () => {
    await setup();
    const a = (await analyze('message', SCAM_TEXT)).json();
    const b = (await analyze('url', 'bradesc0.com.br')).json();
    const body = (await get()).json();
    expect(body.analyses).toEqual({ total: 2, byType: { message: 1, url: 1 } });
    const levelsTotal = Object.values(body.levels as Record<string, number>).reduce((x, y) => x + y, 0);
    expect(levelsTotal).toBe(2);
    expect(body.levels[a.report.level]).toBeGreaterThan(0);
    expect(body.levels[b.report.level]).toBeGreaterThan(0);
    expect(Object.values(body.categories as Record<string, number>).some((n) => n > 0)).toBe(true);
  });

  it('análise inválida (URL rejeitada) não conta', async () => {
    await setup();
    await analyze('url', 'ftp://x');
    expect((await get()).json().analyses.total).toBe(0);
  });

  it('cache serve o valor antigo até o TTL e atualiza depois', async () => {
    let now = 1_000_000;
    await setup({ METRICS_CACHE_TTL_MS: '5000' }, { now: () => now });
    expect((await get()).json().analyses.total).toBe(0);
    await analyze('url', 'bradesc0.com.br');
    now += 4999;
    expect((await get()).json().analyses.total).toBe(0);
    now += 2;
    expect((await get()).json().analyses.total).toBe(1);
  });

  it('Cache-Control público com max-age em segundos', async () => {
    await setup({ METRICS_CACHE_TTL_MS: '60000' });
    expect((await get()).headers['cache-control']).toBe('public, max-age=60');
  });

  it('totais de feedback com SQLite real', async () => {
    const store = createSqliteFeedbackStore(':memory:');
    await setup({ METRICS_CACHE_TTL_MS: '1000' }, { feedbackStore: store });
    const ref = 'a1'.repeat(32);
    const base = { target: { type: 'url', ref }, level: 'HIGH_RISK', signalIds: [] };
    for (const type of ['SCAM_REPORT', 'SCAM_REPORT', 'FALSE_POSITIVE']) {
      await app.inject({ method: 'POST', url: '/api/v1/feedback', payload: { ...base, type } });
    }
    expect((await get()).json().feedback).toEqual({ scamReports: 2, falsePositives: 1 });
  });

  it('totals() que lança -> 200 com feedback zerado, sem vazar o erro', async () => {
    const failing: FeedbackStore = {
      save: () => undefined,
      summary: () => ({ scamReports: 0, falsePositives: 0 }),
      totals: () => {
        throw new Error('disco-secreto-cheio');
      },
      close: () => undefined,
    };
    await setup({}, { feedbackStore: failing });
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.json().feedback).toEqual({ scamReports: 0, falsePositives: 0 });
    expect(res.body).not.toContain('disco-secreto');
  });

  it('LGPD: o corpo não contém o texto analisado nem a targetRef', async () => {
    await setup();
    const analyzed = (await analyze('message', SCAM_TEXT)).json();
    const res = await get();
    expect(res.body).not.toContain('dinheiro fácil');
    expect(res.body).not.toContain(analyzed.targetRef);
  });

  it('429 com contador próprio da rota', async () => {
    await setup({ RATE_LIMIT_MAX: '2' });
    expect((await get('10.0.0.1')).statusCode).toBe(200);
    expect((await get('10.0.0.1')).statusCode).toBe(200);
    const blocked = await get('10.0.0.1');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect((await get('10.0.0.2')).statusCode).toBe(200);
  });
});
