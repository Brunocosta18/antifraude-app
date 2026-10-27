import type { RiskLevel, Severity, Signal } from '../types.js';

/** Pesos padrão por severidade. */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 50,
  high: 35,
  medium: 20,
  low: 8,
};

/** Score a partir do qual o nível é Alto Risco (além de qualquer sinal `critical`). */
export const HIGH_RISK_THRESHOLD = 60;
/** Score a partir do qual o nível é Requer Atenção. */
export const NEEDS_ATTENTION_THRESHOLD = 20;
/** Fração dos demais sinais da mesma categoria que ainda contribui com o score. */
export const CATEGORY_REST_FACTOR = 0.25;
export const MAX_SCORE = 100;

export interface ScoreResult {
  level: RiskLevel;
  score: number;
}

/**
 * Cada categoria contribui com o maior peso + 25% dos demais, para que muitos sinais
 * fracos repetidos não inflem a nota. Qualquer sinal `critical` força Alto Risco.
 */
export function scoreSignals(signals: readonly Signal[]): ScoreResult {
  const byCategory = new Map<string, number[]>();
  for (const signal of signals) {
    const list = byCategory.get(signal.category) ?? [];
    list.push(signal.weight);
    byCategory.set(signal.category, list);
  }

  let total = 0;
  for (const weights of byCategory.values()) {
    const sorted = [...weights].sort((a, b) => b - a);
    const [max = 0, ...rest] = sorted;
    total += max + CATEGORY_REST_FACTOR * rest.reduce((sum, w) => sum + w, 0);
  }

  const score = Math.min(MAX_SCORE, Math.round(total));
  const hasCritical = signals.some((s) => s.severity === 'critical');

  let level: RiskLevel = 'NO_KNOWN_INDICATORS';
  if (hasCritical || score >= HIGH_RISK_THRESHOLD) level = 'HIGH_RISK';
  else if (score >= NEEDS_ATTENTION_THRESHOLD) level = 'NEEDS_ATTENTION';

  return { level, score };
}
