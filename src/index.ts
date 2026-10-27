import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp(config);

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Encerrando servidor');
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
  // Apenas a mensagem: evita despejar objetos que possam carregar dados sensíveis.
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`[antifraude-api] Falha ao iniciar: ${message}`);
  process.exit(1);
});
