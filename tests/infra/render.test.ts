import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Verificações estáticas (sem acessar o Render) do Blueprint de deploy.
const raiz = resolve(import.meta.dirname, '../..');
const render = readFileSync(resolve(raiz, 'render.yaml'), 'utf8');

describe('render.yaml', () => {
  it('usa Docker no plano free com o Dockerfile da API e o contexto na raiz', () => {
    expect(render).toMatch(/runtime:\s*docker/);
    expect(render).toMatch(/plan:\s*free/);
    expect(render).toMatch(/dockerfilePath:\s*\.\/apps\/api\/Dockerfile/);
    expect(render).toMatch(/dockerContext:\s*\.\s*$/m);
    expect(render).toMatch(/healthCheckPath:\s*\/health/);
  });

  it('só faz deploy depois que o CI passa', () => {
    expect(render).toMatch(/autoDeployTrigger:\s*checksPass/);
  });

  it('configura produção atrás de proxy e na porta do Dockerfile', () => {
    expect(render).toMatch(/key:\s*NODE_ENV,\s*value:\s*production/);
    expect(render).toMatch(/key:\s*HOST,\s*value:\s*0\.0\.0\.0/);
    expect(render).toMatch(/key:\s*PORT,\s*value:\s*"3000"/);
    expect(render).toMatch(/key:\s*TRUST_PROXY,\s*value:\s*"1"/);
  });

  it('deixa CORS_ORIGIN e URLHAUS_AUTH_KEY para o painel (sync: false)', () => {
    expect(render).toMatch(/key:\s*CORS_ORIGIN,\s*sync:\s*false/);
    expect(render).toMatch(/key:\s*URLHAUS_AUTH_KEY,\s*sync:\s*false/);
  });

  it('liga o feed Phishing.Database (sem segredo)', () => {
    expect(render).toMatch(/key:\s*PHISHING_DB_ENABLED,\s*value:\s*"true"/);
  });

  it('não versiona segredo nem CORS aberto', () => {
    expect(render).not.toMatch(/key:\s*CORS_ORIGIN,\s*value/);
    expect(render).not.toMatch(/key:\s*URLHAUS_AUTH_KEY,\s*value/);
    expect(render).not.toMatch(/CORS_ORIGIN[^\n]*\*/);
  });
});
