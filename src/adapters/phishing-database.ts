import { getDomain } from 'tldts';

import { SEVERITY_WEIGHTS } from '../core/risk/risk-scorer.js';
import type { Signal, ThreatFeed } from '../core/types.js';
import { FeedFailure, isTrustedHost, readLimitedText, type FeedLogger } from './shared.js';

/**
 * Adaptador do Phishing.Database (lista pública de domínios de phishing ativos, MIT, sem chave).
 * Privacidade: o servidor baixa a lista inteira e consulta só em memória — nenhum dado do usuário
 * sai do servidor (o `check` não faz rede). O destino é fixo (não o site do usuário), por isso
 * `assertPublicDestination` não se aplica.
 * Logs: só `reason` (e o status HTTP) — nunca hostname, URL ou conteúdo da lista.
 */

/** Lista de domínios ativos (~11 MB em 2026-10). */
export const PHISHING_DB_LIST_URL =
  'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt';

/** ~2× o tamanho real da lista (11 MB), para absorver crescimento sem aceitar respostas absurdas. */
const MAX_LIST_BYTES = 24 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;

/** Hostname plausível: rótulos [a-z0-9_-] separados por ponto, com ao menos um ponto. */
const HOSTNAME_LINE = /^(?=.{3,253}$)[a-z0-9_-]+(\.[a-z0-9_-]+)+$/;

export interface PhishingDatabaseFeedOptions {
  listUrl: string;
  refreshMs: number;
  fetchFn?: typeof fetch;
  logger: FeedLogger;
  /** Sobrescritas só para testes. */
  maxListBytes?: number;
  timeoutMs?: number;
}

export interface PhishingDatabaseFeed extends ThreatFeed {
  /** Primeiro download sem bloquear o boot + atualização periódica. */
  start(): void;
  stop(): void;
  /** Baixa e troca a lista; em falha mantém a anterior. Nunca lança. */
  refresh(): Promise<void>;
}

const DOMAIN_SIGNAL: Signal = {
  id: 'TI-PHISHDB-DOMAIN',
  category: 'threat_intel',
  severity: 'high',
  weight: SEVERITY_WEIGHTS.high,
  title: 'Site listado como phishing',
  explanation:
    'Este site consta no Phishing.Database, base aberta de domínios usados em golpes de phishing (páginas falsas que roubam dados).',
  advice: 'Não abra o link nem informe dados ou senhas. Se já informou, troque a senha e avise seu banco.',
};

function parseList(text: string): Set<string> {
  const domains = new Set<string>();
  for (const raw of text.split('\n')) {
    const line = raw.trim().toLowerCase();
    if (line === '' || line.startsWith('#')) continue;
    if (HOSTNAME_LINE.test(line)) domains.add(line);
  }
  return domains;
}

/** O hostname e cada domínio pai, até o domínio registrável (inclusive). */
function candidates(hostname: string): string[] {
  const registrable = getDomain(hostname);
  const result = [hostname];
  if (registrable === null) return result;
  let current = hostname;
  while (current !== registrable && current.includes('.')) {
    current = current.slice(current.indexOf('.') + 1);
    result.push(current);
  }
  return result;
}

export function createPhishingDatabaseFeed({
  listUrl,
  refreshMs,
  fetchFn = fetch,
  logger,
  maxListBytes = MAX_LIST_BYTES,
  timeoutMs = DOWNLOAD_TIMEOUT_MS,
}: PhishingDatabaseFeedOptions): PhishingDatabaseFeed {
  let domains: Set<string> | null = null;
  let timer: NodeJS.Timeout | null = null;
  let refreshing = false;

  async function download(): Promise<Set<string>> {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetchFn(listUrl, { redirect: 'error', signal });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new FeedFailure('http_status', response.status);
      }
      return parseList(await readLimitedText(response, maxListBytes));
    } catch (error) {
      if (error instanceof FeedFailure) throw error;
      throw new FeedFailure(signal.aborted ? 'timeout' : 'network');
    }
  }

  async function refresh(): Promise<void> {
    if (refreshing) return;
    refreshing = true;
    try {
      domains = await download();
    } catch (error) {
      const failure = error instanceof FeedFailure ? error : new FeedFailure('network');
      logger.warn({
        feed: 'phishing_database',
        reason: failure.reason,
        ...(failure.httpStatus === undefined ? {} : { httpStatus: failure.httpStatus }),
      });
    } finally {
      refreshing = false;
    }
  }

  return {
    refresh,
    start() {
      if (timer !== null) return;
      void refresh();
      timer = setInterval(() => void refresh(), refreshMs);
      timer.unref();
    },
    stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    },
    async check(urls) {
      if (domains === null) return { status: 'unavailable', signals: [] };
      const listed = domains;
      const hit = urls.some(
        (url) => !isTrustedHost(url.hostname) && candidates(url.hostname).some((domain) => listed.has(domain)),
      );
      return { status: 'checked', signals: hit ? [DOMAIN_SIGNAL] : [] };
    },
  };
}
