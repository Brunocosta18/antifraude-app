// Smoke test da imagem Docker (requer Docker). Uso: npm run docker:smoke
import { spawnSync } from 'node:child_process';

const URL_HEALTH = 'http://127.0.0.1:3000/health';

function docker(args, { allowFail = false } = {}) {
  const r = spawnSync('docker', args, { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFail) {
    throw new Error(`docker ${args.join(' ')} falhou (código ${r.status}): ${(r.stderr || '').trim()}`);
  }
  return (r.stdout || '').trim();
}

function step(msg) {
  console.log(`[smoke] ${msg}`);
}

let failed = false;
try {
  step('compose up --build --wait');
  docker(['compose', 'up', '-d', '--build', '--wait']);

  step('GET /health');
  const res = await fetch(URL_HEALTH);
  const body = await res.json();
  if (res.status !== 200 || body.status !== 'ok') {
    throw new Error(`/health inesperado: HTTP ${res.status}`);
  }

  step('usuário do processo');
  const user = docker(['compose', 'exec', '-T', 'api', 'whoami']);
  if (user !== 'node') throw new Error(`usuário esperado "node", obtido "${user}"`);

  const id = docker(['compose', 'ps', '-aq', 'api']).split('\n')[0];
  if (!id) throw new Error('container da api não encontrado');

  step('compose stop (shutdown gracioso)');
  docker(['compose', 'stop', 'api']);
  const exitCode = docker(['inspect', '--format', '{{.State.ExitCode}}', id]);
  if (exitCode !== '0') throw new Error(`ExitCode esperado 0, obtido ${exitCode}`);

  step('OK');
} catch (err) {
  failed = true;
  console.error(`[smoke] FALHA: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  docker(['compose', 'down'], { allowFail: true });
}
process.exit(failed ? 1 : 0);
