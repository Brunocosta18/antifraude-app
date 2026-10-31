import type { AnalysisReport, RiskLevel, SignalCategory } from '../types.js';

/** Tipos de alvo analisado (espelha o `type` do `POST /analyze`). */
export type AnalyzeType = 'message' | 'url';

/** Espelham as uniões de `core/types.ts`; o `satisfies` abaixo falha na compilação se faltar algum valor. */
export const RISK_LEVELS = ['HIGH_RISK', 'NEEDS_ATTENTION', 'NO_KNOWN_INDICATORS'] as const;
export const SIGNAL_CATEGORIES = [
  'easy_money',
  'fake_billing',
  'urgency',
  'credential_request',
  'impersonation',
  'payment_pressure',
  'fake_prize',
  'fake_job',
  'domain',
  'url_structure',
  'threat_intel',
] as const;

// Teste de tipo: as listas cobrem exatamente as uniões (qualquer valor faltante ou sobrando vira erro).
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _levelsComplete: Equal<(typeof RISK_LEVELS)[number], RiskLevel> = true;
const _categoriesComplete: Equal<(typeof SIGNAL_CATEGORIES)[number], SignalCategory> = true;
void _levelsComplete;
void _categoriesComplete;

/** Só contagens inteiras por enum. Nenhum conteúdo, targetRef, IP, signalId ou hora de análise (LGPD). */
export interface AnalysisMetrics {
  /** Data (sem hora) em que o contador começou. */
  since: string;
  analyses: { total: number; byType: Record<AnalyzeType, number> };
  levels: Record<RiskLevel, number>;
  /** Análises com ao menos um sinal da categoria (uma contagem por análise). */
  categories: Record<SignalCategory, number>;
}

export interface MetricsCounter {
  record(type: AnalyzeType, report: AnalysisReport): void;
  snapshot(): AnalysisMetrics;
}

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

/** Contadores agregados em memória (zeram no restart). */
export function createMetricsCounter(now: () => number = Date.now): MetricsCounter {
  const since = new Date(now()).toISOString().slice(0, 10);
  let total = 0;
  const byType = zeroed<AnalyzeType>(['message', 'url']);
  const levels = zeroed(RISK_LEVELS);
  const categories = zeroed(SIGNAL_CATEGORIES);

  return {
    record(type, report) {
      total += 1;
      byType[type] += 1;
      levels[report.level] += 1;
      for (const category of new Set(report.signals.map((signal) => signal.category))) categories[category] += 1;
    },
    snapshot() {
      return { since, analyses: { total, byType: { ...byType } }, levels: { ...levels }, categories: { ...categories } };
    },
  };
}
