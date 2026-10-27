import type { NormalizedUrl } from '../utils/url.js';

/** Modelo de domínio do motor de análise. Nenhum campo guarda texto ou URL do usuário (LGPD). */

export type RiskLevel = 'HIGH_RISK' | 'NEEDS_ATTENTION' | 'NO_KNOWN_INDICATORS';

/** Rótulos PT-BR fixos. Nunca afirmamos que algo é seguro. */
export const RISK_LABELS: Record<RiskLevel, string> = {
  HIGH_RISK: 'Alto Risco',
  NEEDS_ATTENTION: 'Requer Atenção',
  NO_KNOWN_INDICATORS: 'Nenhum Indicador Conhecido Encontrado',
};

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type SignalCategory =
  | 'easy_money'
  | 'fake_billing'
  | 'urgency'
  | 'credential_request'
  | 'impersonation'
  | 'payment_pressure'
  | 'fake_prize'
  | 'fake_job'
  | 'domain'
  | 'url_structure'
  | 'threat_intel';

export interface Signal {
  /** Identificador estável da regra (ex.: `MSG-URUBU-PIX`). */
  id: string;
  category: SignalCategory;
  severity: Severity;
  weight: number;
  /** Texto fixo em PT-BR simples. */
  title: string;
  /** Por que isso é um sinal de golpe. */
  explanation: string;
  /** O que o usuário deve fazer. */
  advice: string;
}

/** Resultado da consulta a fontes externas: `disabled` = não configurada; `unavailable` = falhou/expirou. */
export type ExternalCheckStatus = 'checked' | 'unavailable' | 'disabled';

export interface AnalysisReport {
  level: RiskLevel;
  label: string;
  /** 0 a 100. */
  score: number;
  signals: Signal[];
  advice: string[];
  disclaimer: string;
  externalCheck: ExternalCheckStatus;
}

export const DISCLAIMER = 'Esta análise usa sinais conhecidos e não é 100% infalível. Na dúvida, não pague e confirme pelo canal oficial.';

/**
 * Porta para fontes externas de reputação. Contrato: nunca lança e respeita o próprio prazo;
 * em falha devolve `unavailable` (mantendo os sinais já obtidos) e a análise local segue valendo.
 */
export interface ThreatFeed {
  check(urls: readonly NormalizedUrl[]): Promise<{ status: ExternalCheckStatus; signals: Signal[] }>;
}
