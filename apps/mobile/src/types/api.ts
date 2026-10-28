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
  report: AnalysisReport;
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
  | 'NOT_FOUND'
  | 'REQUEST_ERROR'
  | 'INTERNAL_ERROR';

/** Códigos gerados só pelo cliente. */
export type ClientErrorCode = 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export type ApiErrorCode = ServerErrorCode | ClientErrorCode;
