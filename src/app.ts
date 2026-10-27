import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { errorHandler, notFoundHandler } from './api/errors.js';
import { analyzeRoutes } from './api/routes/analyze.js';
import { healthRoutes } from './api/routes/health.js';
import type { AppConfig } from './config/env.js';

/**
 * Campos que nunca podem aparecer nos logs (CLAUDE.md §2 — Logs Limpos / LGPD).
 * Rede de segurança caso algum objeto com esses nomes seja logado no futuro.
 */
const REDACTED_LOG_PATHS = [
  '*.password',
  '*.senha',
  '*.cpf',
  '*.pixKey',
  '*.chavePix',
  '*.token',
  '*.authorization',
  '*.cookie',
];

function loggerOptions(config: AppConfig): FastifyServerOptions['logger'] {
  if (config.nodeEnv === 'test') return false;
  return {
    level: config.logLevel,
    redact: { paths: REDACTED_LOG_PATHS, censor: '[REDACTED]' },
    serializers: {
      // Minimização: sem headers, IP, query string ou corpo — a query pode conter links/dados do usuário.
      req: (req: { method: string; url: string; id: string }) => ({
        id: req.id,
        method: req.method,
        path: req.url.split('?', 1)[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  };
}

/** Fábrica da aplicação: monta plugins e rotas sem abrir porta (facilita testes). */
export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: loggerOptions(config) });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsOrigin === true ? true : [...config.corsOrigin],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
    maxAge: 600,
  });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  await app.register(healthRoutes, { appVersion: config.appVersion });
  await app.register(analyzeRoutes, { prefix: '/api/v1' });

  return app;
}
