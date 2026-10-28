import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Verificações estáticas (sem rodar o GitHub Actions) do workflow de CI.
const raiz = resolve(import.meta.dirname, '../..');
const ci = readFileSync(resolve(raiz, '.github/workflows/ci.yml'), 'utf8');

describe('.github/workflows/ci.yml', () => {
  it('dispara em push na main e em pull_request', () => {
    expect(ci).toMatch(/^on:\s*$/m);
    expect(ci).toMatch(/^\s+push:\s*\n\s+branches:\s*\[main\]/m);
    expect(ci).toMatch(/^\s+pull_request:/m);
  });

  it('usa permissões mínimas e cancela runs antigas', () => {
    expect(ci).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m);
    expect(ci).toMatch(/group:\s*ci-\$\{\{\s*github\.ref\s*\}\}/);
    expect(ci).toMatch(/cancel-in-progress:\s*true/);
  });

  it('tem os jobs api, mobile e docker com timeout', () => {
    for (const job of ['api', 'mobile', 'docker']) {
      expect(ci).toMatch(new RegExp(`^  ${job}:\s*$`, 'm'));
    }
    expect(ci.match(/timeout-minutes:\s*\d+/g)?.length).toBe(3);
  });

  it('usa Node 24 com cache npm', () => {
    expect(ci).toMatch(/node-version:\s*24/);
    expect(ci).toMatch(/cache:\s*npm/);
  });

  it('roda typecheck, testes e smoke do Docker', () => {
    expect(ci).toMatch(/run:\s*npm run typecheck/);
    expect(ci).toMatch(/run:\s*npm test\s*$/m);
    expect(ci).toMatch(/run:\s*npm test -- --ci/);
    expect(ci).toMatch(/run:\s*npm run docker:smoke/);
    expect(ci).toMatch(/working-directory:\s*apps\/mobile/);
  });

  it('não usa segredos', () => {
    expect(ci).not.toContain('secrets.');
    expect(ci).not.toContain('URLHAUS_AUTH_KEY');
  });
});
