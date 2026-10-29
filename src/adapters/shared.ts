import { getDomain } from 'tldts';

import { findOfficialBrand } from '../core/domain/brands.js';

/** Peças compartilhadas pelos adaptadores de threat feed (URLhaus, Phishing.Database). */

/** Plataformas legítimas que hospedam conteúdo de terceiros: host listado ali não condena o domínio todo. */
export const SHARED_PLATFORM_DOMAINS: ReadonlySet<string> = new Set([
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

export type ThreatFeedName = 'urlhaus' | 'phishing_database';

export interface FeedLogger {
  warn(obj: { feed: ThreatFeedName; reason: ThreatFeedFailureReason; httpStatus?: number }): void;
}

export class FeedFailure extends Error {
  constructor(
    readonly reason: ThreatFeedFailureReason,
    readonly httpStatus?: number,
  ) {
    super(reason);
  }
}

export function isTrustedHost(hostname: string): boolean {
  const registrable = getDomain(hostname);
  if (registrable !== null && SHARED_PLATFORM_DOMAINS.has(registrable)) return true;
  return findOfficialBrand(hostname) !== null;
}

/** Lê o corpo com corte em `maxBytes`, sem confiar em Content-Length. */
export async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new FeedFailure('too_large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
