import type { ExternalCheckStatus, Signal, ThreatFeed } from '../core/types.js';

type FeedResult = { status: ExternalCheckStatus; signals: Signal[] };

/**
 * Combina vários feeds: consulta em paralelo e junta os sinais.
 * Status: algum `unavailable` → `unavailable`; senão algum `checked` → `checked`; senão `disabled`.
 * Um feed que lança conta como `unavailable` e não derruba os demais.
 */
export function combineFeeds(feeds: readonly ThreatFeed[]): ThreatFeed {
  return {
    async check(urls) {
      const results = await Promise.all(
        feeds.map((feed) => feed.check(urls).catch((): FeedResult => ({ status: 'unavailable', signals: [] }))),
      );
      const statuses = results.map((result) => result.status);
      const status: ExternalCheckStatus = statuses.includes('unavailable')
        ? 'unavailable'
        : statuses.includes('checked')
          ? 'checked'
          : 'disabled';
      return { status, signals: results.flatMap((result) => result.signals) };
    },
  };
}
