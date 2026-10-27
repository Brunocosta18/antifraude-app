import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { domainToUnicode } from 'node:url';

import { isPublicIp } from './ip.js';
import { removeInvisibleChars } from './text.js';

/**
 * Normalização de URLs enviadas pelo usuário e proteção contra SSRF.
 *
 * O parser WHATWG `URL` é a fonte da verdade: o hostname só é validado depois do parse,
 * que já converte formas ofuscadas (`http://2130706433`, `0x7f.1`, `127.1` → `127.0.0.1`;
 * `ⓛⓞⓒⓐⓛⓗⓞⓢⓣ` → `localhost`; IDN → punycode).
 */

export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; reason: E };

export type UrlRejectionReason =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'INVALID_URL'
  | 'UNSUPPORTED_SCHEME'
  | 'LOCAL_HOSTNAME'
  | 'PRIVATE_ADDRESS';

export type DestinationRejectionReason = 'PRIVATE_ADDRESS' | 'RESOLVES_TO_PRIVATE' | 'DNS_FAILURE';

export interface NormalizedUrl {
  /** URL canônica: sem credenciais, sem fragmento, sem porta padrão, host em minúsculas/punycode. */
  href: string;
  protocol: 'http:' | 'https:';
  /** Hostname ASCII (punycode). IPv6 vem entre colchetes. */
  hostname: string;
  /** Hostname em Unicode — base para detecção de homógrafos (ex.: "а" cirílico). */
  hostnameUnicode: string;
  /** `null` quando é a porta padrão do esquema. */
  port: number | null;
  pathname: string;
  search: string;
  /** O usuário não informou esquema e `http://` foi assumido. */
  schemeInferred: boolean;
  /** A URL original tinha `usuario:senha@` — técnica comum de phishing (`https://banco.com@golpe.xyz`). */
  hadCredentials: boolean;
  isIpLiteral: boolean;
}

export const DEFAULT_URL_MAX_LENGTH = 2048;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Sufixos que nunca resolvem para a internet pública. */
const LOCAL_SUFFIXES = ['localhost', 'local', 'localdomain', 'internal', 'lan', 'home.arpa'];

/** `esquema:resto` onde `resto` não é só uma porta (para não confundir `banco.com:8080` com esquema). */
const EXPLICIT_SCHEME = /^([a-z][a-z0-9+.-]*):(.*)$/is;
const PORT_AFTER_COLON = /^\d+(?:[/?#]|$)/;

function hasExplicitScheme(input: string): boolean {
  const match = EXPLICIT_SCHEME.exec(input);
  return match !== null && !PORT_AFTER_COLON.test(match[2] ?? '');
}

function isLocalHostname(hostname: string): boolean {
  if (!hostname.includes('.')) return true; // nome de rótulo único: "intranet", "router"
  return LOCAL_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

export interface NormalizeUrlOptions {
  maxLength?: number;
}

export function normalizeUrl(input: unknown, options: NormalizeUrlOptions = {}): Result<NormalizedUrl, UrlRejectionReason> {
  const maxLength = options.maxLength ?? DEFAULT_URL_MAX_LENGTH;
  if (typeof input !== 'string') return { ok: false, reason: 'EMPTY' };
  if (input.length > maxLength * 2) return { ok: false, reason: 'TOO_LONG' };

  // CR/LF/tab nunca são legítimos dentro de uma URL (evita injeção em logs/cabeçalhos).
  const cleaned = removeInvisibleChars(input).replace(/[\t\n]/g, '').trim();
  if (cleaned.length === 0) return { ok: false, reason: 'EMPTY' };
  if (cleaned.length > maxLength) return { ok: false, reason: 'TOO_LONG' };

  let candidate = cleaned;
  let schemeInferred = false;
  if (candidate.startsWith('//')) {
    candidate = `http:${candidate}`;
    schemeInferred = true;
  } else if (!hasExplicitScheme(candidate)) {
    candidate = `http://${candidate}`;
    schemeInferred = true;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: 'INVALID_URL' };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return { ok: false, reason: 'UNSUPPORTED_SCHEME' };

  const hostname = url.hostname.replace(/\.+$/, '');
  if (hostname.length === 0) return { ok: false, reason: 'INVALID_URL' };

  const isIpLiteral = hostname.startsWith('[') || isIP(hostname) === 4;
  if (isIpLiteral) {
    if (!isPublicIp(hostname)) return { ok: false, reason: 'PRIVATE_ADDRESS' };
  } else if (isLocalHostname(hostname)) {
    return { ok: false, reason: 'LOCAL_HOSTNAME' };
  }

  const hadCredentials = url.username !== '' || url.password !== '';
  url.username = '';
  url.password = '';
  url.hash = '';
  url.hostname = hostname;

  return {
    ok: true,
    value: {
      href: url.href,
      protocol: url.protocol as NormalizedUrl['protocol'],
      hostname,
      hostnameUnicode: isIpLiteral ? hostname : domainToUnicode(hostname) || hostname,
      port: url.port === '' ? null : Number(url.port),
      pathname: url.pathname,
      search: url.search,
      schemeInferred,
      hadCredentials,
      isIpLiteral,
    },
  };
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type LookupFn = (hostname: string) => Promise<readonly ResolvedAddress[]>;

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

export interface AssertPublicDestinationOptions {
  lookup?: LookupFn;
  timeoutMs?: number;
}

/**
 * Garante que **todos** os endereços para os quais o hostname resolve são públicos.
 * Erro, timeout ou resolução vazia → `DNS_FAILURE` (fail closed).
 *
 * ⚠️ Para quem for fazer requisições HTTP ao destino: conecte ao IP retornado aqui
 * (não resolva de novo — DNS rebinding) e repita esta verificação a cada redirect.
 */
export async function assertPublicDestination(
  hostname: string,
  options: AssertPublicDestinationOptions = {},
): Promise<Result<string[], DestinationRejectionReason>> {
  const host = hostname.replace(/^\[(.*)\]$/, '$1').replace(/\.+$/, '');
  if (isIP(host) !== 0) {
    return isPublicIp(host) ? { ok: true, value: [host] } : { ok: false, reason: 'PRIVATE_ADDRESS' };
  }

  const lookup = options.lookup ?? defaultLookup;
  const timeoutMs = options.timeoutMs ?? 2000;

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('DNS timeout')), timeoutMs);
  });

  let addresses: readonly ResolvedAddress[];
  try {
    addresses = await Promise.race([lookup(host), timeout]);
  } catch {
    return { ok: false, reason: 'DNS_FAILURE' };
  } finally {
    clearTimeout(timer);
  }

  if (addresses.length === 0) return { ok: false, reason: 'DNS_FAILURE' };
  if (addresses.some(({ address }) => !isPublicIp(address))) return { ok: false, reason: 'RESOLVES_TO_PRIVATE' };
  return { ok: true, value: addresses.map(({ address }) => address) };
}

/** Sufixos comuns de arquivo/e-mail que parecem domínios mas não são links. */
const NOT_A_TLD = new Set(['png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'doc', 'docx', 'html', 'js', 'json', 'zip']);

const EXPLICIT_URL = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const BARE_DOMAIN = /(?<![@\w./-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[a-z]{2,24}(?:[/?#][^\s<>"'`]*)?(?![\p{L}\p{N}@])/giu;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"»]+$/;

/**
 * Extrai links de um texto livre: `http(s)://...` e domínios soltos com TLD alfabético
 * (`golpe.xyz/pix`). Remove pontuação final, deduplica e respeita `limit`.
 */
export function extractUrls(text: string, limit = 10): string[] {
  if (typeof text !== 'string' || text.length === 0 || limit <= 0) return [];
  const found: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string): void => {
    const candidate = raw.replace(TRAILING_PUNCTUATION, '');
    if (candidate.length === 0) return;
    const key = candidate.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(candidate);
  };

  const explicit = text.match(EXPLICIT_URL) ?? [];
  for (const url of explicit) push(url);

  // Domínios soltos: ignora trechos que já estão dentro de uma URL explícita.
  const withoutExplicit = text.replace(EXPLICIT_URL, ' ');
  for (const match of withoutExplicit.match(BARE_DOMAIN) ?? []) {
    const host = match.split(/[/?#]/)[0] ?? '';
    const tld = host.slice(host.lastIndexOf('.') + 1).toLowerCase();
    if (NOT_A_TLD.has(tld)) continue;
    push(match);
  }

  return found.slice(0, limit);
}
