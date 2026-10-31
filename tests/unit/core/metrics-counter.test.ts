import { describe, expect, it } from 'vitest';

import { createMetricsCounter, RISK_LEVELS, SIGNAL_CATEGORIES } from '../../../src/core/metrics/counter.js';
import type { AnalysisReport, RiskLevel, Signal, SignalCategory } from '../../../src/core/types.js';

const signal = (category: SignalCategory): Signal => ({
  id: `T-${category}`,
  category,
  severity: 'high',
  weight: 10,
  title: 't',
  explanation: 'e',
  advice: 'a',
});

const report = (level: RiskLevel, categories: SignalCategory[] = []): AnalysisReport => ({
  level,
  label: 'x',
  score: 0,
  signals: categories.map(signal),
  advice: [],
  disclaimer: 'd',
  externalCheck: 'disabled',
});

describe('createMetricsCounter', () => {
  it('as listas espelham as uniões de tipos (11 categorias, 3 níveis)', () => {
    expect([...RISK_LEVELS].sort()).toEqual(['HIGH_RISK', 'NEEDS_ATTENTION', 'NO_KNOWN_INDICATORS']);
    expect(SIGNAL_CATEGORIES).toHaveLength(11);
    expect(new Set(SIGNAL_CATEGORIES).size).toBe(11);
  });

  it('começa zerado com todas as chaves preenchidas', () => {
    const snap = createMetricsCounter().snapshot();
    expect(snap.analyses).toEqual({ total: 0, byType: { message: 0, url: 0 } });
    expect(Object.keys(snap.levels).sort()).toEqual([...RISK_LEVELS].sort());
    expect(Object.keys(snap.categories).sort()).toEqual([...SIGNAL_CATEGORIES].sort());
    expect(Object.values(snap.categories).every((n) => n === 0)).toBe(true);
  });

  it('conta por nível e por tipo', () => {
    const counter = createMetricsCounter();
    counter.record('message', report('HIGH_RISK'));
    counter.record('url', report('HIGH_RISK'));
    counter.record('url', report('NO_KNOWN_INDICATORS'));
    const snap = counter.snapshot();
    expect(snap.analyses).toEqual({ total: 3, byType: { message: 1, url: 2 } });
    expect(snap.levels).toEqual({ HIGH_RISK: 2, NEEDS_ATTENTION: 0, NO_KNOWN_INDICATORS: 1 });
  });

  it('conta a categoria uma vez por análise (deduplicada)', () => {
    const counter = createMetricsCounter();
    counter.record('message', report('HIGH_RISK', ['urgency', 'urgency', 'easy_money']));
    counter.record('message', report('NEEDS_ATTENTION', ['urgency']));
    const snap = counter.snapshot();
    expect(snap.categories.urgency).toBe(2);
    expect(snap.categories.easy_money).toBe(1);
    expect(snap.categories.domain).toBe(0);
  });

  it('since traz só a data (sem hora)', () => {
    const counter = createMetricsCounter(() => Date.UTC(2026, 9, 29, 13, 45, 10));
    expect(counter.snapshot().since).toBe('2026-10-29');
  });
});
