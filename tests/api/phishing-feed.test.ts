import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { combineFeeds } from '../../src/adapters/composite-feed.js';
import { createPhishingDatabaseFeed } from '../../src/adapters/phishing-database.js';
import { createUrlhausFeed } from '../../src/adapters/urlhaus.js';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';

const LIST_URL = 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function analyze(listResponse: () => Response, content: string) {
  const logger = { warn: vi.fn() };
  const phishing = createPhishingDatabaseFeed({
    listUrl: LIST_URL,
    refreshMs: 3_600_000,
    fetchFn: vi.fn<typeof fetch>(async () => listResponse()),
    logger,
  });
  const urlhaus = createUrlhausFeed({
    authKey: 'k',
    timeoutMs: 500,
    fetchFn: vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ query_status: 'no_results' }))),
    logger,
  });
  await phishing.refresh();
  app = await buildApp(loadConfig({ NODE_ENV: 'test', CORS_ORIGIN: 'http://localhost:8081' }), {
    threatFeed: combineFeeds([phishing, urlhaus]),
  });
  const res = await app.inject({ method: 'POST', url: '/api/v1/analyze', payload: { type: 'url', content } });
  expect(res.statusCode).toBe(200);
  return res.json().report as { level: string; externalCheck: string; signals: { id: string }[] };
}

describe('POST /api/v1/analyze com Phishing.Database + URLhaus', () => {
  const list = () => new Response('# lista\nconta-segura-login.example.net\n');

  it('domínio listado → TI-PHISHDB-DOMAIN e risco elevado', async () => {
    const report = await analyze(list, 'https://conta-segura-login.example.net/entrar');
    expect(report.signals.map((s) => s.id)).toContain('TI-PHISHDB-DOMAIN');
    expect(['HIGH_RISK', 'NEEDS_ATTENTION']).toContain(report.level);
    expect(report.externalCheck).toBe('checked');
  });

  it('domínio não listado → sem o sinal', async () => {
    const report = await analyze(list, 'https://exemplo-legitimo.example.com');
    expect(report.signals.map((s) => s.id)).not.toContain('TI-PHISHDB-DOMAIN');
    expect(report.externalCheck).toBe('checked');
  });

  it('lista indisponível → externalCheck unavailable e análise local mantida', async () => {
    const report = await analyze(() => new Response('erro', { status: 500 }), 'http://192.168.0.1.bb-seguro.xyz/login');
    expect(report.externalCheck).toBe('unavailable');
    expect(report.signals.length).toBeGreaterThan(0);
  });
});
