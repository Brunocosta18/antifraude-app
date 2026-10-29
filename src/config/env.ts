import { readFileSync } from 'node:fs';
import { z } from 'zod';

/**
 * Configuração da aplicação, validada na inicialização.
 * Falhas de configuração devem impedir o boot (fail fast) em vez de
 * gerar comportamento inseguro silencioso.
 */

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().trim().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    CORS_ORIGIN: z.string().trim().default('http://localhost:8081'),
    // Opcional (chave gratuita do abuse.ch); vazio = feed desligado. Nunca aparece em mensagens de erro.
    URLHAUS_AUTH_KEY: z
      .string()
      .trim()
      .optional()
      .transform((key) => (key ? key : null)),
    THREAT_FEED_TIMEOUT_MS: z.coerce.number().int().min(100).max(2000).default(2000),
    // Lista pública de phishing baixada pelo servidor (sem chave). Desligada por padrão: testes e CI nunca usam a rede.
    PHISHING_DB_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    PHISHING_DB_REFRESH_MS: z.coerce.number().int().min(3_600_000).max(86_400_000).default(21_600_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(30),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
    // Atrás de proxy reverso (ex.: Render): 'true' | 'false' | nº de saltos (1 a 10). Sem isso o rate limit enxerga só o IP do proxy.
    TRUST_PROXY: z
      .string()
      .trim()
      .regex(/^(true|false|([1-9]|10))$/, 'Use "true", "false" ou um inteiro de 1 a 10.')
      .default('false')
      .transform((value): boolean | number => (value === 'true' ? true : value === 'false' ? false : Number(value))),
  })
  .transform((env) => ({
    ...env,
    CORS_ORIGIN: env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  }))
  .superRefine((env, ctx) => {
    if (env.CORS_ORIGIN.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'Informe ao menos uma origem.' });
    }
    if (env.NODE_ENV === 'production' && env.CORS_ORIGIN.includes('*')) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN="*" não é permitido em produção. Liste as origens explicitamente.',
      });
    }
  });

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly logLevel: (typeof LOG_LEVELS)[number];
  /** `true` libera qualquer origem (apenas fora de produção); caso contrário, lista explícita. */
  readonly corsOrigin: true | readonly string[];
  readonly appVersion: string;
  /** `null` = feed URLhaus desligado (análise só local). */
  readonly urlhausAuthKey: string | null;
  readonly threatFeedTimeoutMs: number;
  /** Feed Phishing.Database ligado (a lista é baixada pelo servidor e consultada em memória). */
  readonly phishingDbEnabled: boolean;
  readonly phishingDbRefreshMs: number;
  /** Máximo de requisições por IP em `POST /analyze` dentro da janela. */
  readonly rateLimitMax: number;
  readonly rateLimitWindowMs: number;
  /** Saltos de proxy confiáveis (`true` = todos, `false` = nenhum) para obter o IP real do cliente. */
  readonly trustProxy: boolean | number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function readAppVersion(): string {
  try {
    // Funciona tanto em src/config/ quanto em dist/config/ (dois níveis abaixo da raiz).
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      version?: unknown;
    };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Mensagens citam apenas o nome da variável, nunca o valor recebido.
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Configuração inválida — ${details}`);
  }

  const {
    NODE_ENV,
    HOST,
    PORT,
    LOG_LEVEL,
    CORS_ORIGIN,
    URLHAUS_AUTH_KEY,
    THREAT_FEED_TIMEOUT_MS,
    PHISHING_DB_ENABLED,
    PHISHING_DB_REFRESH_MS,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
    TRUST_PROXY,
  } = parsed.data;
  return Object.freeze({
    nodeEnv: NODE_ENV,
    host: HOST,
    port: PORT,
    logLevel: LOG_LEVEL,
    corsOrigin: CORS_ORIGIN.includes('*') ? true : Object.freeze([...CORS_ORIGIN]),
    appVersion: readAppVersion(),
    urlhausAuthKey: URLHAUS_AUTH_KEY,
    threatFeedTimeoutMs: THREAT_FEED_TIMEOUT_MS,
    phishingDbEnabled: PHISHING_DB_ENABLED,
    phishingDbRefreshMs: PHISHING_DB_REFRESH_MS,
    rateLimitMax: RATE_LIMIT_MAX,
    rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
    trustProxy: TRUST_PROXY,
  });
}
