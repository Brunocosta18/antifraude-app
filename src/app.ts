import { randomBytes } from 'node:crypto';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { errorHandler, notFoundHandler } from './api/errors.js';
import { analyzeRoutes } from './api/routes/analyze.js';
import { feedbackRoutes } from './api/routes/feedback.js';
import { healthRoutes } from './api/routes/health.js';
import { combineFeeds } from './adapters/composite-feed.js';
import { createPhishingDatabaseFeed, PHISHING_DB_LIST_URL } from './adapters/phishing-database.js';
import { createSqliteFeedbackStore } from './adapters/sqlite-feedback-store.js';
import { createUrlhausFeed, disabledThreatFeed } from './adapters/urlhaus.js';
import type { AppConfig } from './config/env.js';
import type { FeedbackStore } from './core/feedback/types.js';
import type { ThreatFeed } from './core/types.js';

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
  '*.authKey',
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

/**
 * O Fastify 5 ignora `trustProxy` numérico (falha fechada), então o nº de saltos vira função:
 * confia nos N saltos a partir do socket, e o IP do cliente passa a ser a entrada seguinte do X-Forwarded-For.
 */
function trustProxyOption(trustProxy: boolean | number): boolean | ((address: string, hop: number) => boolean) {
  return typeof trustProxy === 'number' ? (_address, hop) => hop < trustProxy : trustProxy;
}

/** Fábrica da aplicação: monta plugins e rotas sem abrir porta (facilita testes). */
export async function buildApp(config: AppConfig, deps: { threatFeed?: ThreatFeed; feedbackStore?: FeedbackStore } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: loggerOptions(config), trustProxy: trustProxyOption(config.trustProxy) });

  let threatFeed = deps.threatFeed ?? disabledThreatFeed;
  if (deps.threatFeed === undefined) {
    const feedLogger = app.log.child({ component: 'threat-feed' });
    const feeds: ThreatFeed[] = [];
    if (config.urlhausAuthKey === null) {
      app.log.info('Threat feed URLhaus desligado (sem URLHAUS_AUTH_KEY): análise apenas local');
    } else {
      feeds.push(
        createUrlhausFeed({ authKey: config.urlhausAuthKey, timeoutMs: config.threatFeedTimeoutMs, logger: feedLogger }),
      );
    }
    if (config.phishingDbEnabled) {
      const phishingDb = createPhishingDatabaseFeed({
        listUrl: PHISHING_DB_LIST_URL,
        refreshMs: config.phishingDbRefreshMs,
        logger: feedLogger,
      });
      phishingDb.start(); // download em segundo plano; até concluir, o feed responde `unavailable`
      app.addHook('onClose', async () => phishingDb.stop());
      feeds.push(phishingDb);
    }
    if (feeds.length > 0) threatFeed = combineFeeds(feeds);
  }

  let feedbackSecret = config.feedbackHmacSecret;
  if (feedbackSecret === null) {
    feedbackSecret = randomBytes(32).toString('hex');
    app.log.info('FEEDBACK_HMAC_SECRET ausente: segredo aleatório por processo (as refs de feedback agregam só até o restart)');
  }
  const feedbackStore = deps.feedbackStore ?? createSqliteFeedbackStore(config.feedbackDbPath);
  app.addHook('onClose', async () => feedbackStore.close());

  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsOrigin === true ? true : [...config.corsOrigin],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
    maxAge: 600,
  });

  // global: false — o limite vale só nas rotas que o ativam (/health e 404 ficam fora). Contadores só em memória.
  await app.register(rateLimit, { global: false });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  await app.register(healthRoutes, { appVersion: config.appVersion });
  await app.register(analyzeRoutes, {
    prefix: '/api/v1',
    threatFeed,
    feedbackSecret,
    rateLimit: { max: config.rateLimitMax, timeWindow: config.rateLimitWindowMs },
  });
  await app.register(feedbackRoutes, {
    prefix: '/api/v1',
    store: feedbackStore,
    rateLimit: { max: config.rateLimitMax, timeWindow: config.rateLimitWindowMs },
  });

  return app;
}
