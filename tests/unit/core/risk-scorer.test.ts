import { describe, expect, it } from 'vitest';

import {
  HIGH_RISK_THRESHOLD,
  NEEDS_ATTENTION_THRESHOLD,
  SEVERITY_WEIGHTS,
  scoreSignals,
} from '../../../src/core/risk/risk-scorer.js';
import type { Severity, Signal, SignalCategory } from '../../../src/core/types.js';

let counter = 0;
function signal(severity: Severity, category: SignalCategory = 'domain', weight?: number): Signal {
  counter += 1;
  return {
    id: `T-${counter}`,
    category,
    severity,
    weight: weight ?? SEVERITY_WEIGHTS[severity],
    title: 't',
    explanation: 'e',
    advice: 'a',
  };
}

describe('scoreSignals', () => {
  it('sem sinais: nenhum indicador, score 0', () => {
    expect(scoreSignals([])).toEqual({ level: 'NO_KNOWN_INDICATORS', score: 0 });
  });

  it('usa os limiares esperados', () => {
    expect(NEEDS_ATTENTION_THRESHOLD).toBe(20);
    expect(HIGH_RISK_THRESHOLD).toBe(60);
  });

  it('borda 19/20: abaixo de 20 é nenhum indicador, 20 é requer atenção', () => {
    expect(scoreSignals([signal('low', 'domain', 19)])).toEqual({ level: 'NO_KNOWN_INDICATORS', score: 19 });
    expect(scoreSignals([signal('low', 'domain', 20)])).toEqual({ level: 'NEEDS_ATTENTION', score: 20 });
  });

  it('borda 59/60: 59 é requer atenção, 60 é alto risco', () => {
    expect(scoreSignals([signal('high', 'domain', 59)])).toEqual({ level: 'NEEDS_ATTENTION', score: 59 });
    expect(scoreSignals([signal('high', 'domain', 60)])).toEqual({ level: 'HIGH_RISK', score: 60 });
  });

  it('um sinal low isolado não passa de nenhum indicador', () => {
    expect(scoreSignals([signal('low')]).level).toBe('NO_KNOWN_INDICATORS');
  });

  it('um medium isolado já é requer atenção', () => {
    expect(scoreSignals([signal('medium')]).level).toBe('NEEDS_ATTENTION');
  });

  it('qualquer critical força alto risco, mesmo com score baixo', () => {
    const result = scoreSignals([signal('critical', 'domain', 10)]);
    expect(result.level).toBe('HIGH_RISK');
    expect(result.score).toBe(10);
  });

  it('um high mais um medium de outra categoria somam por categoria', () => {
    const result = scoreSignals([signal('high', 'credential_request', 40), signal('medium', 'urgency')]);
    expect(result).toEqual({ level: 'HIGH_RISK', score: 60 });
  });

  it('teto por categoria: 5 sinais low iguais não viram alto risco', () => {
    const result = scoreSignals(Array.from({ length: 5 }, () => signal('low', 'url_structure')));
    // 8 + 25% de (4 × 8) = 16
    expect(result).toEqual({ level: 'NO_KNOWN_INDICATORS', score: 16 });
  });

  it('na mesma categoria conta o maior peso mais 25% dos demais', () => {
    const result = scoreSignals([signal('high', 'domain'), signal('medium', 'domain')]);
    expect(result.score).toBe(40); // 35 + 0,25 × 20
  });

  it('o score é limitado a 100', () => {
    const result = scoreSignals([
      signal('critical', 'domain'),
      signal('critical', 'easy_money'),
      signal('critical', 'credential_request'),
    ]);
    expect(result.score).toBe(100);
    expect(result.level).toBe('HIGH_RISK');
  });

  it('não depende da ordem dos sinais', () => {
    const a = [signal('high', 'domain'), signal('low', 'domain'), signal('medium', 'urgency')];
    expect(scoreSignals(a)).toEqual(scoreSignals([...a].reverse()));
  });
});
