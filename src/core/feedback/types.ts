import type { RiskLevel } from '../types.js';

export type FeedbackType = 'SCAM_REPORT' | 'FALSE_POSITIVE';
export type FeedbackTargetType = 'message' | 'url';

/** Registro anônimo: só referência opaca, nível e IDs de regra. Sem conteúdo, IP nem identificador de dispositivo. */
export interface FeedbackEntry {
  type: FeedbackType;
  targetType: FeedbackTargetType;
  targetRef: string;
  level: RiskLevel;
  signalIds: string[];
}

export interface FeedbackSummary {
  scamReports: number;
  falsePositives: number;
}

/** Porta de armazenamento do feedback (ANTIGOL-017). */
export interface FeedbackStore {
  save(entry: FeedbackEntry): void;
  summary(targetRef: string): FeedbackSummary;
  /** Totais gerais (todas as refs), para o painel de métricas (ANTIGOL-018). */
  totals(): FeedbackSummary;
  close(): void;
}
