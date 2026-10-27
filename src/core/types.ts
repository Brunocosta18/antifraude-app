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
  | 'url_structure';

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

export interface AnalysisReport {
  level: RiskLevel;
  label: string;
  /** 0 a 100. */
  score: number;
  signals: Signal[];
  advice: string[];
  disclaimer: string;
}

export const DISCLAIMER = 'Esta análise usa sinais conhecidos e não é 100% infalível. Na dúvida, não pague e confirme pelo canal oficial.';
