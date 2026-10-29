import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPhishingDatabaseFeed } from '../../../src/adapters/phishing-database.js';
import { normalizeUrl, type NormalizedUrl } from '../../../src/utils/url.js';

const LIST_URL = 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt';

function url(input: string): NormalizedUrl {
  const result = normalizeUrl(input);
  if (!result.ok) throw new Error('URL de teste inválida');
  return result.value;
}

const text = (body: string, status = 200): Response => new Response(body, { status });

const LIST = [
  '# comentário',
  '',
  'Golpe-Banco.example.net',
  '  phish.example.org  ',
  'invalido sem ponto',
  'google.com',
  'bb.com.br',
].join('\n');

function setup(fetchFn: typeof fetch, extra: { maxListBytes?: number; timeoutMs?: number } = {}) {
  const logger = { warn: vi.fn() };
  const feed = createPhishingDatabaseFeed({ listUrl: LIST_URL, refreshMs: 3_600_000, fetchFn, logger, ...extra });
  return { feed, logger };
}

afterEach(() => vi.useRealTimers());

describe('createPhishingDatabaseFeed', () => {
  it('antes do primeiro download → unavailable (sem sinais)', async () => {
    const { feed } = setup(vi.fn<typeof fetch>(async () => text(LIST)));
    expect(await feed.check([url('https://golpe-banco.example.net')])).toEqual({ status: 'unavailable', signals: [] });
  });

  it('parse ignora comentários, linhas vazias e inválidas; casa o host em minúsculas', async () => {
    const { feed } = setup(vi.fn<typeof fetch>(async () => text(LIST)));
    await feed.refresh();
    const result = await feed.check([url('https://GOLPE-banco.example.net/login')]);
    expect(result.status).toBe('checked');
    expect(result.signals).toMatchObject([{ id: 'TI-PHISHDB-DOMAIN', category: 'threat_intel', severity: 'high' }]);
    expect((await feed.check([url('https://phish.example.org')])).signals).toHaveLength(1);
    expect((await feed.check([url('https://naolistado.example.com')])).signals).toEqual([]);
  });

  it('casa subdomínios de domínio listado', async () => {
    const { feed } = setup(vi.fn<typeof fetch>(async () => text(LIST)));
    await feed.refresh();
    expect((await feed.check([url('https://a.b.phish.example.org/x')])).signals).toHaveLength(1);
  });

  it('plataformas compartilhadas e marcas oficiais são ignoradas', async () => {
    const { feed } = setup(vi.fn<typeof fetch>(async () => text(LIST)));
    await feed.refresh();
    expect((await feed.check([url('https://drive.google.com/a')])).signals).toEqual([]);
    expect((await feed.check([url('https://www.bb.com.br/a')])).signals).toEqual([]);
  });

  it('check não faz requisições de rede', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => text(LIST));
    const { feed } = setup(fetchFn);
    await feed.refresh();
    fetchFn.mockClear();
    await feed.check([url('https://phish.example.org')]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('baixa só a URL fixa da lista, com redirect: error', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => text(LIST));
    const { feed } = setup(fetchFn);
    await feed.refresh();
    const [calledUrl, init] = fetchFn.mock.calls[0]!;
    expect(calledUrl).toBe(LIST_URL);
    expect(init?.redirect).toBe('error');
  });

  describe('falhas no refresh mantêm a lista anterior', () => {
    async function loadedThenFail(second: typeof fetch, extra: { maxListBytes?: number; timeoutMs?: number } = {}) {
      let calls = 0;
      const fetchFn = vi.fn<typeof fetch>(async (input, init) => (++calls === 1 ? text(LIST) : second(input, init)));
      const ctx = setup(fetchFn, extra);
      await ctx.feed.refresh();
      await ctx.feed.refresh();
      return ctx;
    }

    const stillListed = async (feed: { check: (u: NormalizedUrl[]) => Promise<{ signals: unknown[] }> }) =>
      expect((await feed.check([url('https://phish.example.org')])).signals).toHaveLength(1);

    it('HTTP 500', async () => {
      const { feed, logger } = await loadedThenFail(async () => text('erro', 500));
      expect(logger.warn).toHaveBeenCalledWith({ feed: 'phishing_database', reason: 'http_status', httpStatus: 500 });
      await stillListed(feed);
    });

    it('lista grande demais (too_large)', async () => {
      const { feed, logger } = await loadedThenFail(async () => text('a'.repeat(400)), { maxListBytes: 200 });
      expect(logger.warn).toHaveBeenCalledWith({ feed: 'phishing_database', reason: 'too_large' });
      await stillListed(feed);
    });

    it('timeout', async () => {
      const hang: typeof fetch = (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('abortado')));
        });
      const { feed, logger } = await loadedThenFail(hang, { timeoutMs: 20 });
      expect(logger.warn).toHaveBeenCalledWith({ feed: 'phishing_database', reason: 'timeout' });
      await stillListed(feed);
    });

    it('erro de rede', async () => {
      const { feed, logger } = await loadedThenFail(async () => {
        throw new TypeError('fetch failed');
      });
      expect(logger.warn).toHaveBeenCalledWith({ feed: 'phishing_database', reason: 'network' });
      await stillListed(feed);
    });
  });

  it('falha no primeiro download → continua unavailable', async () => {
    const { feed, logger } = setup(vi.fn<typeof fetch>(async () => text('x', 503)));
    await feed.refresh();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect((await feed.check([url('https://phish.example.org')])).status).toBe('unavailable');
  });

  it('logs nunca contêm hostname nem URL', async () => {
    const { feed, logger } = setup(vi.fn<typeof fetch>(async () => text('x', 500)));
    await feed.refresh();
    await feed.check([url('https://secreto.example.org/path?token=1')]);
    const logged = JSON.stringify(logger.warn.mock.calls);
    expect(logged).not.toMatch(/secreto|example\.org|token/);
  });

  it('start() baixa em segundo plano e refaz a cada refreshMs; stop() limpa o timer', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn<typeof fetch>(async () => text(LIST));
    const { feed } = setup(fetchFn);
    feed.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    feed.stop();
    await vi.advanceTimersByTimeAsync(7_200_000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
