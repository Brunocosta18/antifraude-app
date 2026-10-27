import type { FastifyPluginAsync } from 'fastify';

export interface HealthRouteOptions {
  appVersion: string;
}

const healthResponseSchema = {
  type: 'object',
  required: ['status', 'service', 'version', 'uptimeSeconds', 'timestamp'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['ok'] },
    service: { type: 'string' },
    version: { type: 'string' },
    uptimeSeconds: { type: 'integer', minimum: 0 },
    timestamp: { type: 'string', format: 'date-time' },
  },
} as const;

/** Verificação de saúde (liveness). Não expõe dados de ambiente nem de infraestrutura. */
export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (app, opts) => {
  app.get(
    '/health',
    { schema: { response: { 200: healthResponseSchema } } },
    async () => ({
      status: 'ok' as const,
      service: 'antifraude-api',
      version: opts.appVersion,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }),
  );
};
