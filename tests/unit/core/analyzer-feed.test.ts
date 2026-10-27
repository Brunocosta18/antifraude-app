import { describe, expect, it, vi } from 'vitest';

import { analyzeMessage, analyzeMessageWithFeed, analyzeUrlWithFeed } from '../../../src/core/analyzer.js';
import type { Signal, ThreatFeed } from '../../../src/core/types.js';

const feedSignal = (severity: 'critical' | 'high', weight: number): Signal => ({
  id: 'TI-URLHAUS-URL',
  category: 'threat_intel',
  severity,
  weight,
  title: 'título',
  explanation: 'explicação',
  advice: 'conselho',
});

const feedWith = (status: 'checked' | 'unavailable' | 'disabled', signals: Signal[] = []): ThreatFeed => ({
  check: vi.fn(async () => ({ status, signals })),
});

describe('analyzers com ThreatFeed', () => {
  it('soma os sinais do feed ao score e ao nível', async () => {
    const result = await analyzeUrlWithFeed('exemplo.com.br', feedWith('checked', [feedSignal('critical', 50)]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.level).toBe('HIGH_RISK');
    expect(result.value.score).toBeGreaterThanOrEqual(50);
    expect(result.value.externalCheck).toBe('checked');
    expect(result.value.signals.map((s) => s.id)).toContain('TI-URLHAUS-URL');
  });

  it('feed que lança vira só local + "unavailable"', async () => {
    const feed: ThreatFeed = {
      check: async () => {
        throw new Error('falha');
      },
    };
    const result = await analyzeUrlWithFeed('bradesc0.com.br', feed);
    if (!result.ok) throw new Error('rejeitada');
    expect(result.value.externalCheck).toBe('unavailable');
    expect(result.value.signals.length).toBeGreaterThan(0);
  });

  it('feed desligado mantém o resultado local', async () => {
    const report = await analyzeMessageWithFeed('Ganhe dinheiro fácil', feedWith('disabled'));
    expect(report.externalCheck).toBe('disabled');
    expect(report).toEqual(analyzeMessage('Ganhe dinheiro fácil'));
  });

  it('mensagem com links chama o feed com as URLs normalizadas', async () => {
    const feed = feedWith('checked');
    await analyzeMessageWithFeed('Veja https://Exemplo.com.br/a?b=1 e www.outro.com.br', feed);
    const urls = vi.mocked(feed.check).mock.calls[0]![0];
    expect(urls.map((u) => u.hostname)).toEqual(['exemplo.com.br', 'www.outro.com.br']);
  });

  it('URL inválida não consulta o feed', async () => {
    const feed = feedWith('checked');
    const result = await analyzeUrlWithFeed('http://127.0.0.1', feed);
    expect(result.ok).toBe(false);
    expect(feed.check).not.toHaveBeenCalled();
  });
});
