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

  const { NODE_ENV, HOST, PORT, LOG_LEVEL, CORS_ORIGIN } = parsed.data;
  return Object.freeze({
    nodeEnv: NODE_ENV,
    host: HOST,
    port: PORT,
    logLevel: LOG_LEVEL,
    corsOrigin: CORS_ORIGIN.includes('*') ? true : Object.freeze([...CORS_ORIGIN]),
    appVersion: readAppVersion(),
  });
}
