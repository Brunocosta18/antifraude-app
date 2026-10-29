import { describe, expect, it } from 'vitest';

import { combineFeeds } from '../../../src/adapters/composite-feed.js';
import type { ExternalCheckStatus, Signal, ThreatFeed } from '../../../src/core/types.js';
import { normalizeUrl } from '../../../src/utils/url.js';

const parsed = normalizeUrl('https://exemplo.com.br');
if (!parsed.ok) throw new Error('URL de teste inválida');
const URLS = [parsed.value];

const sig = (id: string): Signal => ({
  id,
  category: 'threat_intel',
  severity: 'high',
  weight: 1,
  title: 't',
  explanation: 'e',
  advice: 'a',
});

const feed = (status: ExternalCheckStatus, ...ids: string[]): ThreatFeed => ({
  check: async () => ({ status, signals: ids.map(sig) }),
});

describe('combineFeeds', () => {
  it.each<[ExternalCheckStatus[], ExternalCheckStatus]>([
    [['checked', 'checked'], 'checked'],
    [['checked', 'unavailable'], 'unavailable'],
    [['unavailable', 'disabled'], 'unavailable'],
    [['checked', 'disabled'], 'checked'],
    [['disabled', 'disabled'], 'disabled'],
    [[], 'disabled'],
  ])('status %j → %s', async (statuses, expected) => {
    const result = await combineFeeds(statuses.map((s) => feed(s))).check(URLS);
    expect(result.status).toBe(expected);
  });

  it('junta os sinais de todos os feeds', async () => {
    const result = await combineFeeds([feed('checked', 'A'), feed('checked', 'B', 'C')]).check(URLS);
    expect(result.signals.map((s) => s.id)).toEqual(['A', 'B', 'C']);
  });

  it('feed que lança vira unavailable sem derrubar os outros', async () => {
    const boom: ThreatFeed = {
      check: async () => {
        throw new Error('falha');
      },
    };
    const result = await combineFeeds([boom, feed('checked', 'B')]).check(URLS);
    expect(result.status).toBe('unavailable');
    expect(result.signals.map((s) => s.id)).toEqual(['B']);
  });
});
