import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalyzeType,
  ApiErrorBody,
  ApiErrorCode,
  ApiErrorDetail,
  FeedbackRequest,
} from '../types/api';

const DEFAULT_TIMEOUT_MS = 10_000;

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');

/** Mensagens PT-BR fixas dos erros gerados no cliente. Nunca incluem o conteúdo do usuário (LGPD). */
const CLIENT_MESSAGES = {
  TIMEOUT: 'A verificação demorou demais. Tente novamente.',
  NETWORK_ERROR: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
  INVALID_RESPONSE: 'O servidor enviou uma resposta inesperada. Tente novamente mais tarde.',
  INTERNAL_ERROR: 'Erro interno. Tente novamente mais tarde.',
  RATE_LIMIT_EXCEEDED: 'Muitas verificações em pouco tempo. Aguarde um pouco e tente novamente.',
} as const;

export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status?: number,
    readonly details?: ApiErrorDetail[],
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export interface RequestOptions {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

function isDetail(d: unknown): d is ApiErrorDetail {
  return (
    typeof d === 'object' &&
    d !== null &&
    typeof (d as ApiErrorDetail).field === 'string' &&
    typeof (d as ApiErrorDetail).issue === 'string'
  );
}

function parseErrorBody(value: unknown): ApiErrorBody['error'] | null {
  if (typeof value !== 'object' || value === null) return null;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const { code, message, details } = error as Record<string, unknown>;
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  const validDetails = Array.isArray(details) && details.every(isDetail);
  return { code, message, details: validDetails ? (details as ApiErrorDetail[]) : undefined };
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('Retry-After')?.trim();
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  return Number.parseInt(raw, 10);
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

async function toAppError(res: Response): Promise<AppError> {
  const parsed = parseErrorBody(await readJson(res));

  if (res.status === 429) {
    const retryAfter = parseRetryAfter(res);
    const message =
      retryAfter !== undefined
        ? `Muitas verificações em pouco tempo. Aguarde ${retryAfter} s e tente novamente.`
        : CLIENT_MESSAGES.RATE_LIMIT_EXCEEDED;
    return new AppError('RATE_LIMIT_EXCEEDED', message, 429, parsed?.details, retryAfter);
  }

  if (parsed) return new AppError(parsed.code as ApiErrorCode, parsed.message, res.status, parsed.details);

  const code = res.status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_RESPONSE';
  return new AppError(code, CLIENT_MESSAGES[code], res.status);
}

export async function request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, fetchFn = fetch } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetchFn(`${API_URL}${path}`, { ...init, signal: controller.signal });
    } catch (e) {
      if (controller.signal.aborted || (e instanceof Error && e.name === 'AbortError')) {
        throw new AppError('TIMEOUT', CLIENT_MESSAGES.TIMEOUT);
      }
      throw new AppError('NETWORK_ERROR', CLIENT_MESSAGES.NETWORK_ERROR);
    }

    if (!res.ok) throw await toAppError(res);

    try {
      return (await res.json()) as T;
    } catch {
      if (controller.signal.aborted) throw new AppError('TIMEOUT', CLIENT_MESSAGES.TIMEOUT);
      throw new AppError('INVALID_RESPONSE', CLIENT_MESSAGES.INVALID_RESPONSE, res.status);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** O conteúdo vai só no corpo; nenhum header extra nem identificador de dispositivo. */
export function analyze(input: AnalyzeRequest, options?: RequestOptions): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>(
    '/api/v1/analyze',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    },
    options,
  );
}

/** Só ref opaca, nível e IDs de regra; nenhum header extra nem identificador de dispositivo. */
export function sendFeedback(input: FeedbackRequest, options?: RequestOptions): Promise<{ status: 'received' }> {
  return request<{ status: 'received' }>(
    '/api/v1/feedback',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    },
    options,
  );
}

const URL_SCHEME = /^https?:\/\//i;
const URL_HOST = /^(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;

/** Um único token com cara de URL vai como 'url'; Pix, telefone, CPF e texto vão como 'message'. */
export function detectAnalyzeType(content: string): AnalyzeType {
  const trimmed = content.trim();
  if (/\s/.test(trimmed)) return 'message';
  if (URL_SCHEME.test(trimmed) || URL_HOST.test(trimmed)) return 'url';
  return 'message';
}

export function analyzeTarget(content: string, options?: RequestOptions): Promise<AnalyzeResponse> {
  const trimmed = content.trim();
  return analyze({ type: detectAnalyzeType(trimmed), content: trimmed }, options);
}
