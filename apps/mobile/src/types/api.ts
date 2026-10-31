/** Espelha o contrato do backend (docs/API.md e src/api/errors.ts). */

export type AnalyzeType = 'message' | 'url';

export interface AnalyzeRequest {
  type: AnalyzeType;
  content: string;
}

export type RiskLevel = 'HIGH_RISK' | 'NEEDS_ATTENTION' | 'NO_KNOWN_INDICATORS';

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Signal {
  id: string;
  category: string;
  severity: SignalSeverity;
  weight: number;
  title: string;
  explanation: string;
  advice: string;
}

export type ExternalCheck = 'checked' | 'unavailable' | 'disabled';

export interface AnalysisReport {
  level: RiskLevel;
  label: string;
  score: number;
  signals: Signal[];
  advice: string[];
  disclaimer: string;
  externalCheck: ExternalCheck;
}

export interface AnalyzeResponse {
  type: AnalyzeType;
  /** Referência opaca do alvo (HMAC): usada no feedback sem reenviar o conteúdo. */
  targetRef: string;
  report: AnalysisReport;
}

export type FeedbackType = 'SCAM_REPORT' | 'FALSE_POSITIVE';

/** Corpo de POST /api/v1/feedback: só a referência opaca, o nível e IDs de regra (nunca o conteúdo). */
export interface FeedbackRequest {
  type: FeedbackType;
  target: { type: AnalyzeType; ref: string };
  level: RiskLevel;
  signalIds: string[];
}

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

/** Resposta de GET /api/v1/metrics: só contagens agregadas e anônimas. */
export interface MetricsResponse {
  since: string;
  generatedAt: string;
  analyses: { total: number; byType: Record<AnalyzeType, number> };
  levels: Record<RiskLevel, number>;
  categories: Record<SignalCategory, number>;
  feedback: { scamReports: number; falsePositives: number };
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

/** Códigos do backend. */
export type ServerErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_URL'
  | 'MALFORMED_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'FEEDBACK_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'REQUEST_ERROR'
  | 'INTERNAL_ERROR';

/** Códigos gerados só pelo cliente. */
export type ClientErrorCode = 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export type ApiErrorCode = ServerErrorCode | ClientErrorCode;
