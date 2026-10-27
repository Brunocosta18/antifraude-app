import { describe, expect, it, vi } from 'vitest';

import { createUrlhausFeed, disabledThreatFeed } from '../../../src/adapters/urlhaus.js';
import { normalizeUrl, type NormalizedUrl } from '../../../src/utils/url.js';

const AUTH_KEY = 'chave-super-secreta-xyz';

function url(input: string): NormalizedUrl {
  const result = normalizeUrl(input);
  if (!result.ok) throw new Error('URL de teste inválida');
  return result.value;
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });

function setup(fetchFn: typeof fetch, timeoutMs = 2000) {
  const logger = { warn: vi.fn() };
  const feed = createUrlhausFeed({ authKey: AUTH_KEY, timeoutMs, fetchFn, logger });
  return { feed, logger };
}

const okFetch = (body: unknown) => vi.fn<typeof fetch>(async () => json(body));

describe('createUrlhausFeed', () => {
  describe('sucesso', () => {
    it('match exato online → TI-URLHAUS-URL critical', async () => {
      const { feed } = setup(
        okFetch({ query_status: 'ok', urls: [{ url: 'http://malware.example.net/a.exe', url_status: 'online' }] }),
      );
      const result = await feed.check([url('http://malware.example.net/a.exe')]);
      expect(result.status).toBe('checked');
      expect(result.signals).toMatchObject([{ id: 'TI-URLHAUS-URL', severity: 'critical', category: 'threat_intel' }]);
    });

    it('match exato offline → high', async () => {
      const { feed } = setup(
        okFetch({ query_status: 'ok', urls: [{ url: 'http://malware.example.net/a.exe', url_status: 'offline' }] }),
      );
      const result = await feed.check([url('http://malware.example.net/a.exe')]);
      expect(result.signals).toMatchObject([{ id: 'TI-URLHAUS-URL', severity: 'high' }]);
    });

    it('só o host online (sem match exato) → TI-URLHAUS-HOST', async () => {
      const { feed } = setup(
        okFetch({ query_status: 'ok', urls: [{ url: 'http://malware.example.net/outra', url_status: 'online' }] }),
      );
      const result = await feed.check([url('http://malware.example.net/limpa')]);
      expect(result.signals).toMatchObject([{ id: 'TI-URLHAUS-HOST', severity: 'high' }]);
    });

    it('host só com URLs offline e sem match exato → sem sinais', async () => {
      const { feed } = setup(
        okFetch({ query_status: 'ok', urls: [{ url: 'http://malware.example.net/x', url_status: 'offline' }] }),
      );
      expect((await feed.check([url('http://malware.example.net/y')])).signals).toEqual([]);
    });

    it('no_results → checked sem sinais', async () => {
      const { feed } = setup(okFetch({ query_status: 'no_results' }));
      expect(await feed.check([url('https://exemplo.com.br')])).toEqual({ status: 'checked', signals: [] });
    });

    it('plataforma compartilhada e marca oficial não geram sinal de host', async () => {
      const body = { query_status: 'ok', urls: [{ url: 'https://x.example.net/y', url_status: 'online' }] };
      const { feed } = setup(okFetch(body));
      expect((await feed.check([url('https://drive.google.com/abc')])).signals).toEqual([]);
      expect((await feed.check([url('https://raw.githubusercontent.com/a/b')])).signals).toEqual([]);
      expect((await feed.check([url('https://www.bb.com.br/x')])).signals).toEqual([]);
    });
  });

  describe('privacidade', () => {
    it('envia só host=, com Auth-Key, redirect error e no máximo 3 requisições', async () => {
      const fetchFn = okFetch({ query_status: 'no_results' });
      const { feed } = setup(fetchFn);
      await feed.check([
        url('https://a.example.com/caminho-secreto?token=1'),
        url('https://a.example.com/outra'),
        url('https://b.example.com/x'),
        url('https://c.example.com/x'),
        url('https://d.example.com/x'),
      ]);

      expect(fetchFn).toHaveBeenCalledTimes(3);
      for (const [endpoint, init] of fetchFn.mock.calls) {
        expect(endpoint).toBe('https://urlhaus-api.abuse.ch/v1/host/');
        expect(init?.method).toBe('POST');
        expect(init?.redirect).toBe('error');
        expect((init?.headers as Record<string, string>)['Auth-Key']).toBe(AUTH_KEY);
        const body = String(init?.body);
        expect(body).toMatch(/^host=[a-z0-9.%-]+$/);
        expect(body).not.toContain('secreto');
        expect(body).not.toContain('token');
      }
    });
  });

  describe('falhas (graceful degradation)', () => {
    it('rede: unavailable, sem sinais e warn com reason "network"', async () => {
      const { feed, logger } = setup(vi.fn<typeof fetch>(async () => Promise.reject(new TypeError('boom'))));
      expect(await feed.check([url('https://exemplo.com.br')])).toEqual({ status: 'unavailable', signals: [] });
      expect(logger.warn).toHaveBeenCalledWith({ feed: 'urlhaus', reason: 'network' });
    });

    it('timeout: unavailable rápido com reason "timeout"', async () => {
      const fetchFn = vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('abortado', 'AbortError')));
          }),
      );
      const { feed, logger } = setup(fetchFn, 50);
      const started = Date.now();
      const result = await feed.check([url('https://exemplo.com.br')]);
      expect(Date.now() - started).toBeLessThan(500);
      expect(result.status).toBe('unavailable');
      expect(logger.warn).toHaveBeenCalledWith({ feed: 'urlhaus', reason: 'timeout' });
    });

    it.each([401, 500])('HTTP %i → http_status', async (status) => {
      const { feed, logger } = setup(vi.fn<typeof fetch>(async () => new Response('erro', { status })));
      expect((await feed.check([url('https://exemplo.com.br')])).status).toBe('unavailable');
      expect(logger.warn).toHaveBeenCalledWith({ feed: 'urlhaus', reason: 'http_status', httpStatus: status });
    });

    it('JSON inválido e schema inválido → invalid_response', async () => {
      for (const body of ['<html>', JSON.stringify({ foo: 1 })]) {
        const { feed, logger } = setup(vi.fn<typeof fetch>(async () => new Response(body)));
        expect((await feed.check([url('https://exemplo.com.br')])).status).toBe('unavailable');
        expect(logger.warn).toHaveBeenCalledWith({ feed: 'urlhaus', reason: 'invalid_response' });
      }
    });

    it('corpo acima de 512 KB → too_large', async () => {
      const { feed, logger } = setup(vi.fn<typeof fetch>(async () => new Response('x'.repeat(600 * 1024))));
      expect((await feed.check([url('https://exemplo.com.br')])).status).toBe('unavailable');
      expect(logger.warn).toHaveBeenCalledWith({ feed: 'urlhaus', reason: 'too_large' });
    });

    it('mantém os sinais das consultas que deram certo quando outra falha', async () => {
      const fetchFn = vi.fn<typeof fetch>(async (_input, init) =>
        String(init?.body).includes('ruim')
          ? Promise.reject(new TypeError('boom'))
          : json({ query_status: 'ok', urls: [{ url: 'http://bom.example.net/a', url_status: 'online' }] }),
      );
      const { feed } = setup(fetchFn);
      const result = await feed.check([url('http://ruim.example.net/a'), url('http://bom.example.net/a')]);
      expect(result.status).toBe('unavailable');
      expect(result.signals).toMatchObject([{ id: 'TI-URLHAUS-URL' }]);
    });
  });

  it('logs limpos: sem hostname nem chave', async () => {
    const failing = setup(vi.fn<typeof fetch>(async () => Promise.reject(new TypeError('segredo.example.org'))));
    await failing.feed.check([url('https://segredo.example.org/p')]);
    const unauthorized = setup(vi.fn<typeof fetch>(async () => new Response('segredo.example.org', { status: 401 })));
    await unauthorized.feed.check([url('https://segredo.example.org/p')]);

    for (const { logger } of [failing, unauthorized]) {
      const logged = JSON.stringify(logger.warn.mock.calls);
      expect(logged).not.toContain('segredo');
      expect(logged).not.toContain(AUTH_KEY);
    }
  });

  it('disabledThreatFeed não consulta nada', async () => {
    expect(await disabledThreatFeed.check([url('https://exemplo.com.br')])).toEqual({ status: 'disabled', signals: [] });
  });
});
