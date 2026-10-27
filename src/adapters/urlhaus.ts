import { getDomain } from 'tldts';
import { z } from 'zod';

import { findOfficialBrand } from '../core/domain/brands.js';
import { SEVERITY_WEIGHTS } from '../core/risk/risk-scorer.js';
import type { ExternalCheckStatus, Severity, Signal, ThreatFeed } from '../core/types.js';
import { normalizeUrl, type NormalizedUrl } from '../utils/url.js';

/**
 * Adaptador do URLhaus (abuse.ch, gratuito com Auth-Key). Só soma `Signal[]` ao scorer.
 * Privacidade: apenas o hostname sai do servidor (`POST /v1/host/`); caminho e query nunca são
 * enviados, e a URL exata é comparada localmente com a lista devolvida.
 * Os destinos são fixos (não o site do usuário), por isso `assertPublicDestination` não se aplica.
 * Logs: só `reason` (e o status HTTP) — nunca hostname, URL, chave ou corpo da resposta.
 */

const URLHAUS_HOST_ENDPOINT = 'https://urlhaus-api.abuse.ch/v1/host/';
const MAX_HOSTS_PER_ANALYSIS = 3;
const MAX_RESPONSE_BYTES = 512 * 1024;

/** Plataformas legítimas que hospedam conteúdo de terceiros: host listado ali não condena o domínio todo. */
const SHARED_PLATFORM_DOMAINS: ReadonlySet<string> = new Set([
  'github.com',
  'githubusercontent.com',
  'google.com',
  'googleusercontent.com',
  'dropbox.com',
  'onedrive.live.com',
  '1drv.ms',
  'discord.com',
  'discordapp.com',
]);

export type ThreatFeedFailureReason = 'timeout' | 'network' | 'http_status' | 'invalid_response' | 'too_large';

export interface FeedLogger {
  warn(obj: { feed: 'urlhaus'; reason: ThreatFeedFailureReason; httpStatus?: number }): void;
}

export interface UrlhausFeedOptions {
  authKey: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
  logger: FeedLogger;
}

/** Só os campos usados; o restante da resposta é ignorado. */
const urlhausResponseSchema = z.object({
  query_status: z.string(),
  urls: z
    .array(z.object({ url: z.string(), url_status: z.string().nullish() }))
    .nullish(),
});

type UrlhausResponse = z.infer<typeof urlhausResponseSchema>;

class FeedFailure extends Error {
  constructor(
    readonly reason: ThreatFeedFailureReason,
    readonly httpStatus?: number,
  ) {
    super(reason);
  }
}

/** Feed desligado (sem chave): não consulta nada. */
export const disabledThreatFeed: ThreatFeed = {
  check: async () => ({ status: 'disabled', signals: [] }),
};

function signal(id: string, severity: Severity, title: string, explanation: string, advice: string): Signal {
  return { id, category: 'threat_intel', severity, weight: SEVERITY_WEIGHTS[severity], title, explanation, advice };
}

const URL_ONLINE = signal(
  'TI-URLHAUS-URL',
  'critical',
  'Link listado como malicioso e ativo',
  'Este link exato consta no URLhaus (abuse.ch), base aberta de links usados para distribuir malware, e está ativo.',
  'Não abra o link nem baixe arquivos. Se já abriu, não informe dados e procure ajuda do seu banco ou de um técnico.',
);

const URL_OFFLINE = signal(
  'TI-URLHAUS-URL',
  'high',
  'Link listado como malicioso',
  'Este link exato consta no URLhaus (abuse.ch), base aberta de links usados para distribuir malware, mas hoje aparece inativo.',
  'Não abra o link: ele pode voltar a funcionar. Desconfie de quem o enviou.',
);

const HOST_ONLINE = signal(
  'TI-URLHAUS-HOST',
  'high',
  'Site com links maliciosos ativos',
  'Este site tem ao menos um link ativo listado no URLhaus (abuse.ch) como distribuidor de malware.',
  'Evite abrir links deste site e não baixe arquivos dele.',
);

function isTrustedHost(hostname: string): boolean {
  const registrable = getDomain(hostname);
  if (registrable !== null && SHARED_PLATFORM_DOMAINS.has(registrable)) return true;
  return findOfficialBrand(hostname) !== null;
}

/** Lê o corpo com corte em 512 KB, sem confiar em Content-Length. */
async function readLimitedText(response: Response): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new FeedFailure('too_large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function queryHost(
  hostname: string,
  authKey: string,
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<UrlhausResponse> {
  let response: Response;
  let text: string;
  try {
    response = await fetchFn(URLHAUS_HOST_ENDPOINT, {
      method: 'POST',
      headers: { 'Auth-Key': authKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ host: hostname }),
      redirect: 'error',
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new FeedFailure('http_status', response.status);
    }
    text = await readLimitedText(response);
  } catch (error) {
    if (error instanceof FeedFailure) throw error;
    throw new FeedFailure(signal.aborted ? 'timeout' : 'network');
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new FeedFailure('invalid_response');
  }
  const parsed = urlhausResponseSchema.safeParse(json);
  if (!parsed.success) throw new FeedFailure('invalid_response');
  return parsed.data;
}

function signalsFor(url: NormalizedUrl, response: UrlhausResponse): Signal[] {
  if (response.query_status !== 'ok') return []; // `no_results`: nada listado
  const listed = response.urls ?? [];

  const exact = listed.filter((entry) => {
    const normalized = normalizeUrl(entry.url);
    return normalized.ok && normalized.value.href === url.href;
  });
  if (exact.length > 0) {
    return [exact.some((entry) => entry.url_status === 'online') ? URL_ONLINE : URL_OFFLINE];
  }
  if (listed.some((entry) => entry.url_status === 'online') && !isTrustedHost(url.hostname)) return [HOST_ONLINE];
  return [];
}

export function createUrlhausFeed({ authKey, timeoutMs, fetchFn = fetch, logger }: UrlhausFeedOptions): ThreatFeed {
  return {
    async check(urls) {
      // Hostnames distintos, no máximo 3; guardamos as URLs de cada um para o match exato local.
      const byHost = new Map<string, NormalizedUrl[]>();
      for (const url of urls) {
        const list = byHost.get(url.hostname);
        if (list) list.push(url);
        else if (byHost.size < MAX_HOSTS_PER_ANALYSIS) byHost.set(url.hostname, [url]);
      }

      // Um único prazo para a análise inteira (consultas em paralelo).
      const abortSignal = AbortSignal.timeout(timeoutMs);
      const hosts = [...byHost.keys()];
      const results = await Promise.allSettled(hosts.map((host) => queryHost(host, authKey, fetchFn, abortSignal)));

      let status: ExternalCheckStatus = 'checked';
      const signals: Signal[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          status = 'unavailable';
          const failure = result.reason instanceof FeedFailure ? result.reason : new FeedFailure('network');
          logger.warn({
            feed: 'urlhaus',
            reason: failure.reason,
            ...(failure.httpStatus === undefined ? {} : { httpStatus: failure.httpStatus }),
          });
          return;
        }
        for (const url of byHost.get(hosts[index] as string) ?? []) signals.push(...signalsFor(url, result.value));
      });
      return { status, signals };
    },
  };
}
