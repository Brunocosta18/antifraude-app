import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { createSqliteFeedbackStore } from '../../src/adapters/sqlite-feedback-store.js';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import type { FeedbackEntry, FeedbackStore } from '../../src/core/feedback/types.js';

const URL_PATH = '/api/v1/feedback';
const REF = 'a1'.repeat(32);
const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
const valid = () => ({
  type: 'SCAM_REPORT',
  target: { type: 'url', ref: REF },
  level: 'HIGH_RISK',
  signalIds: ['DOM-TEST', 'MSG-URUBU-PIX'],
});

function memoryStore(): FeedbackStore & { saved: FeedbackEntry[] } {
  const saved: FeedbackEntry[] = [];
  return {
    saved,
    save: (entry) => void saved.push(entry),
    summary: () => ({ scamReports: 0, falsePositives: 0 }),
    totals: () => ({ scamReports: 0, falsePositives: 0 }),
    close: () => undefined,
  };
}

describe('POST /api/v1/feedback', () => {
  let app: FastifyInstance;

  async function setup(env: Record<string, string> = {}, store?: FeedbackStore): Promise<void> {
    app = await buildApp(
      loadConfig({ NODE_ENV: 'test', RATE_LIMIT_MAX: '10000', FEEDBACK_HMAC_SECRET: SECRET, ...env }),
      store ? { feedbackStore: store } : {},
    );
    await app.ready();
  }

  afterEach(async () => {
    await app.close();
  });

  const post = (payload: unknown, headers: Record<string, string> = {}, remoteAddress?: string) =>
    app.inject({ method: 'POST', url: URL_PATH, payload: payload as object, headers, remoteAddress });

  it('201 { status: "received" }, sem cache', async () => {
    const store = memoryStore();
    await setup({}, store);
    const res = await post(valid());
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ status: 'received' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(store.saved).toEqual([
      { type: 'SCAM_REPORT', targetType: 'url', targetRef: REF, level: 'HIGH_RISK', signalIds: ['DOM-TEST', 'MSG-URUBU-PIX'] },
    ]);
  });

  it('signalIds é opcional (padrão vazio)', async () => {
    const store = memoryStore();
    await setup({}, store);
    const { signalIds: _omit, ...body } = valid();
    expect((await post(body)).statusCode).toBe(201);
    expect(store.saved[0]!.signalIds).toEqual([]);
  });

  it('o registro salvo não contém IP nem cabeçalhos', async () => {
    const store = memoryStore();
    await setup({}, store);
    await post(valid(), { 'user-agent': 'agente-secreto-xyz', 'x-forwarded-for': '203.0.113.9' }, '198.51.100.7');
    expect(JSON.stringify(store.saved)).not.toMatch(/agente-secreto|203\.0\.113|198\.51\.100/);
  });

  const invalid: [string, unknown][] = [
    ['type inválido', { ...valid(), type: 'OUTRO' }],
    ['ref inválida', { ...valid(), target: { type: 'url', ref: 'curta-segredo-1' } }],
    ['ref maiúscula', { ...valid(), target: { type: 'url', ref: REF.toUpperCase() } }],
    ['target.type inválido', { ...valid(), target: { type: 'sms', ref: REF } }],
    ['level inválido', { ...valid(), level: 'MEDIO' }],
    ['campo extra', { ...valid(), content: 'segredo-do-usuario' }],
    ['campo extra em target', { ...valid(), target: { type: 'url', ref: REF, url: 'segredo-do-usuario' } }],
    ['signalId inválido', { ...valid(), signalIds: ['minusculo segredo'] }],
    ['signalIds demais', { ...valid(), signalIds: Array.from({ length: 21 }, () => 'A') }],
    ['corpo array', []],
  ];

  it.each(invalid)('422 VALIDATION_ERROR: %s', async (_name, payload) => {
    await setup({}, memoryStore());
    const res = await post(payload);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.body).not.toContain('segredo');
  });

  it('415 para Content-Type que não é JSON', async () => {
    await setup({}, memoryStore());
    const res = await app.inject({
      method: 'POST',
      url: URL_PATH,
      payload: JSON.stringify(valid()),
      headers: { 'content-type': 'text/plain' },
    });
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('413 acima de 4 KB', async () => {
    await setup({}, memoryStore());
    const res = await app.inject({
      method: 'POST',
      url: URL_PATH,
      payload: JSON.stringify({ ...valid(), extra: 'x'.repeat(5000) }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('429 com contador próprio da rota e isolado por IP', async () => {
    await setup({ RATE_LIMIT_MAX: '2' }, memoryStore());
    expect((await post(valid(), {}, '10.0.0.1')).statusCode).toBe(201);
    expect((await post(valid(), {}, '10.0.0.1')).statusCode).toBe(201);
    const blocked = await post(valid(), {}, '10.0.0.1');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect((await post(valid(), {}, '10.0.0.2')).statusCode).toBe(201);
  });

  it('503 FEEDBACK_UNAVAILABLE quando o armazenamento falha, sem vazar o erro', async () => {
    const failing: FeedbackStore = {
      save: () => {
        throw new Error('disco-secreto-cheio');
      },
      summary: () => ({ scamReports: 0, falsePositives: 0 }),
      totals: () => ({ scamReports: 0, falsePositives: 0 }),
      close: () => undefined,
    };
    await setup({}, failing);
    const res = await post(valid());
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('FEEDBACK_UNAVAILABLE');
    expect(res.body).not.toContain('disco-secreto');
  });

  it('analyze -> feedback com a targetRef devolvida soma no summary (SQLite real)', async () => {
    const store = createSqliteFeedbackStore(':memory:');
    await setup({}, store);
    const analyzed = (
      await app.inject({ method: 'POST', url: '/api/v1/analyze', payload: { type: 'url', content: 'bradesc0.com.br' } })
    ).json();
    const body = {
      type: 'FALSE_POSITIVE',
      target: { type: analyzed.type, ref: analyzed.targetRef },
      level: analyzed.report.level,
      signalIds: analyzed.report.signals.map((s: { id: string }) => s.id),
    };
    expect((await post(body)).statusCode).toBe(201);
    expect((await post({ ...body, type: 'SCAM_REPORT' })).statusCode).toBe(201);
    expect((await post({ ...body, type: 'SCAM_REPORT' })).statusCode).toBe(201);
    expect(store.summary(analyzed.targetRef)).toEqual({ scamReports: 2, falsePositives: 1 });
  });
});
