import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { RISK_LABELS, type ThreatFeed } from '../../src/core/types.js';
import { LEGIT_URLS, SCAM_URLS } from '../fixtures/urls.js';
import { LEGIT_MESSAGES, SCAM_MESSAGES } from '../fixtures/messages.js';

const ALLOWED_ORIGIN = 'http://localhost:8081';
const URL_PATH = '/api/v1/analyze';
const RANK = { NO_KNOWN_INDICATORS: 0, NEEDS_ATTENTION: 1, HIGH_RISK: 2 } as const;

describe('POST /api/v1/analyze', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(loadConfig({ NODE_ENV: 'test', CORS_ORIGIN: ALLOWED_ORIGIN, RATE_LIMIT_MAX: '10000' }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (payload: unknown, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url: URL_PATH, payload: payload as object, headers });

  const postRaw = (body: string, contentType = 'application/json') =>
    app.inject({ method: 'POST', url: URL_PATH, payload: body, headers: { 'content-type': contentType } });

  describe('sucesso', () => {
    it.each(SCAM_URLS)('URL golpista $url', async ({ url, expectedLevel, expectedSignals }) => {
      const res = await post({ type: 'url', content: url });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.type).toBe('url');
      expect(body.report.level).toBe(expectedLevel);
      const ids = body.report.signals.map((s: { id: string }) => s.id);
      expect(ids).toEqual(expect.arrayContaining(expectedSignals));
    });

    it.each(LEGIT_URLS)('URL legítima %s nunca é Alto Risco', async (url) => {
      const res = await post({ type: 'url', content: url });
      expect(res.statusCode).toBe(200);
      expect(res.json().report.level).not.toBe('HIGH_RISK');
    });

    it.each(SCAM_MESSAGES)('mensagem golpista: $name', async ({ text, expectedLevel, expectedSignals }) => {
      const res = await post({ type: 'message', content: text });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.type).toBe('message');
      expect(RANK[body.report.level as keyof typeof RANK]).toBeGreaterThanOrEqual(RANK[expectedLevel]);
      const ids = body.report.signals.map((s: { id: string }) => s.id);
      expect(ids).toEqual(expect.arrayContaining(expectedSignals));
    });

    it('mensagem neutra: nenhum indicador conhecido', async () => {
      const neutral = LEGIT_MESSAGES[0]!;
      const res = await post({ type: 'message', content: neutral.text });
      expect(res.statusCode).toBe(200);
      const { report } = res.json();
      expect(report.level).toBe('NO_KNOWN_INDICATORS');
      expect(report.label).toBe(RISK_LABELS.NO_KNOWN_INDICATORS);
      expect(report.signals).toEqual([]);
    });
  });

  describe('formato e cabeçalhos', () => {
    it('responde JSON, sem cache e com o relatório completo', async () => {
      const res = await post({ type: 'url', content: 'bradesc0.com.br' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
      expect(res.headers['cache-control']).toBe('no-store');

      const body = res.json();
      expect(Object.keys(body).sort()).toEqual(['report', 'type']);
      expect(Object.keys(body.report).sort()).toEqual(['advice', 'disclaimer', 'externalCheck', 'label', 'level', 'score', 'signals']);
      expect(body.report.disclaimer).toEqual(expect.any(String));
      expect(body.report.disclaimer.length).toBeGreaterThan(0);
      expect(Array.isArray(body.report.advice)).toBe(true);
      expect(body.report.score).toBeGreaterThanOrEqual(0);
      expect(body.report.score).toBeLessThanOrEqual(100);
      expect(Object.keys(body.report.signals[0]).sort()).toEqual([
        'advice',
        'category',
        'explanation',
        'id',
        'severity',
        'title',
        'weight',
      ]);
    });
  });

  describe('LGPD: o conteúdo enviado não volta na resposta', () => {
    it('URL', async () => {
      const content = 'https://usuario-secreto-123.example.xyz/caminho-privado?token=abc987';
      const res = await post({ type: 'url', content });
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain('usuario-secreto-123');
      expect(res.body).not.toContain('caminho-privado');
      expect(res.body).not.toContain('abc987');
    });

    it('mensagem com CPF e telefone fictícios', async () => {
      const content = 'Meu CPF 123.456.789-09 e telefone (11) 91234-5678, faça um Pix urgente.';
      const res = await post({ type: 'message', content });
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain('123.456.789-09');
      expect(res.body).not.toContain('91234-5678');
      expect(res.body).not.toContain(content);
    });
  });

  describe('422 VALIDATION_ERROR', () => {
    const cases: [string, unknown][] = [
      ['corpo array', []],
      ['corpo string', '"texto-secreto-xyz"'],
      ['type ausente', { content: 'segredo-aaa' }],
      ['type desconhecido', { type: 'sms', content: 'segredo-bbb' }],
      ['content ausente', { type: 'url' }],
      ['content numérico', { type: 'message', content: 123456 }],
      ['content vazio', { type: 'message', content: '' }],
      ['content só espaços', { type: 'url', content: '    ' }],
      ['mensagem com 5001 caracteres', { type: 'message', content: 'segredo-ccc'.padEnd(5001, 'a') }],
      ['URL com 2049 caracteres', { type: 'url', content: `https://segredo-ddd.com/${'a'.repeat(2049)}` }],
      ['campo extra', { type: 'message', content: 'segredo-eee', extra: 'segredo-fff' }],
    ];

    it.each(cases)('%s', async (_name, payload) => {
      const res = typeof payload === 'string' ? await postRaw(payload) : await post(payload);
      expect(res.statusCode).toBe(422);
      const { error } = res.json();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toEqual(expect.any(String));
      expect(Array.isArray(error.details)).toBe(true);
      for (const d of error.details) expect(Object.keys(d).sort()).toEqual(['field', 'issue']);
      expect(res.body).not.toMatch(/segredo|aaaaaaaa/);
    });

    it('sem corpo', async () => {
      const res = await app.inject({ method: 'POST', url: URL_PATH });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('corpo vazio com content-type JSON', async () => {
      const res = await postRaw('');
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('422 INVALID_URL', () => {
    it.each([
      ['http://127.0.0.1', 'PRIVATE_ADDRESS'],
      ['http://localhost', 'LOCAL_HOSTNAME'],
      ['ftp://x.com', 'UNSUPPORTED_SCHEME'],
      ['http://192.168.0.1', 'PRIVATE_ADDRESS'],
    ])('%s', async (content, issue) => {
      const res = await post({ type: 'url', content });
      expect(res.statusCode).toBe(422);
      const { error } = res.json();
      expect(error.code).toBe('INVALID_URL');
      expect(error.details).toEqual([{ field: 'content', issue }]);
      expect(res.body).not.toContain(content);
    });
  });

  describe('outros erros', () => {
    it('400 MALFORMED_JSON para JSON inválido', async () => {
      const res = await postRaw('{abc');
      expect(res.statusCode).toBe(400);
      const { error } = res.json();
      expect(error.code).toBe('MALFORMED_JSON');
      expect(res.body).not.toContain('abc');
    });

    it('415 UNSUPPORTED_MEDIA_TYPE para text/plain', async () => {
      const res = await postRaw('segredo-ggg', 'text/plain');
      expect(res.statusCode).toBe(415);
      expect(res.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(res.body).not.toContain('segredo');
    });

    it('413 PAYLOAD_TOO_LARGE acima de 32 KB', async () => {
      const res = await postRaw(JSON.stringify({ type: 'message', content: 'a'.repeat(33 * 1024) }));
      expect(res.statusCode).toBe(413);
      expect(res.json().error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('404 NOT_FOUND para GET na rota de análise', async () => {
      const res = await app.inject({ method: 'GET', url: URL_PATH });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('404 NOT_FOUND para rota inexistente', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/nao-existe' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
    });
  });

  describe('CORS', () => {
    it('responde ao preflight POST de origem permitida', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: URL_PATH,
        headers: {
          origin: ALLOWED_ORIGIN,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('threat feed externo', () => {
    const postWithFeed = async (threatFeed: ThreatFeed, content: string) => {
      const feedApp = await buildApp(loadConfig({ NODE_ENV: 'test', CORS_ORIGIN: ALLOWED_ORIGIN, RATE_LIMIT_MAX: '10000' }), { threatFeed });
      await feedApp.ready();
      const res = await feedApp.inject({ method: 'POST', url: URL_PATH, payload: { type: 'url', content } });
      await feedApp.close();
      return res;
    };

    it('padrão de teste (sem chave): externalCheck "disabled"', async () => {
      const res = await post({ type: 'url', content: 'exemplo.com.br' });
      expect(res.json().report.externalCheck).toBe('disabled');
    });

    it('sinal do feed soma ao resultado: HIGH_RISK + "checked"', async () => {
      const res = await postWithFeed(
        {
          check: async () => ({
            status: 'checked',
            signals: [
              {
                id: 'TI-URLHAUS-URL',
                category: 'threat_intel',
                severity: 'critical',
                weight: 50,
                title: 't',
                explanation: 'e',
                advice: 'a',
              },
            ],
          }),
        },
        'exemplo.com.br',
      );
      const { report } = res.json();
      expect(report.level).toBe('HIGH_RISK');
      expect(report.externalCheck).toBe('checked');
      expect(report.signals.map((x: { id: string }) => x.id)).toContain('TI-URLHAUS-URL');
    });

    it('feed que falha: 200 com resultado local e "unavailable"', async () => {
      const res = await postWithFeed({ check: async () => ({ status: 'unavailable', signals: [] }) }, 'bradesc0.com.br');
      expect(res.statusCode).toBe(200);
      expect(res.json().report.externalCheck).toBe('unavailable');
      expect(res.json().report.signals.length).toBeGreaterThan(0);
    });
  });
});
