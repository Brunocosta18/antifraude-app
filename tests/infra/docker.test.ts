import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Verificações estáticas (sem Docker) dos artefatos de containerização.
const raiz = resolve(import.meta.dirname, '../..');
const ler = (caminho: string): string => readFileSync(resolve(raiz, caminho), 'utf8');

const dockerfile = ler('apps/api/Dockerfile');
const dockerignore = ler('.dockerignore');
const compose = ler('docker-compose.yml');

describe('apps/api/Dockerfile', () => {
  it('usa multi-stage com node:24-alpine', () => {
    expect(dockerfile.match(/^FROM .+ AS .+$/gm)?.length).toBeGreaterThanOrEqual(2);
    expect(dockerfile).toContain('node:24-alpine');
  });

  it('roda como usuário node em produção', () => {
    const users = dockerfile.match(/^USER .+$/gm) ?? [];
    expect(users.at(-1)).toBe('USER node');
    expect(dockerfile).toMatch(/NODE_ENV=production/);
  });

  it('usa CMD em exec-form com node, sem npm', () => {
    const cmd = dockerfile.match(/^CMD (.+)$/m)?.[1] ?? '';
    expect(cmd.startsWith('["node"')).toBe(true);
    expect(cmd).not.toContain('npm');
  });

  it('não embute segredos', () => {
    expect(dockerfile).not.toContain('URLHAUS_AUTH_KEY');
  });
});

describe('.dockerignore', () => {
  const regras = dockerignore
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));

  it('começa em modo allowlist', () => {
    expect(regras[0]).toBe('*');
  });

  it('não libera .env nem node_modules', () => {
    expect(dockerignore).not.toContain('!.env');
    expect(dockerignore).not.toContain('!node_modules');
  });
});

describe('docker-compose.yml', () => {
  it('aponta para o Dockerfile e escuta em 0.0.0.0', () => {
    expect(compose).toContain('apps/api/Dockerfile');
    expect(compose).toMatch(/HOST:\s*0\.0\.0\.0/);
  });

  it('não usa CORS_ORIGIN curinga', () => {
    expect(compose).not.toMatch(/CORS_ORIGIN:\s*["']?\*/);
  });
});
