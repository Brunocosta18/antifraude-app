import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Verificações estáticas (sem acessar a Vercel) da configuração de deploy da PWA.
const raiz = resolve(import.meta.dirname, '../..');
const lerJson = (caminho: string) => JSON.parse(readFileSync(resolve(raiz, caminho), 'utf8'));

interface Header {
  key: string;
  value: string;
}
interface Regra {
  source: string;
  headers: Header[];
}

const vercel = lerJson('apps/mobile/vercel.json');
const pacote = lerJson('apps/mobile/package.json');
const appJson = lerJson('apps/mobile/app.json');

const headersDe = (source: string): Header[] =>
  (vercel.headers as Regra[]).find((regra) => regra.source === source)?.headers ?? [];
const valorDe = (source: string, key: string) =>
  headersDe(source).find((h) => h.key === key)?.value;

describe('apps/mobile/vercel.json', () => {
  it('builda com export:web e publica a pasta dist, sem framework', () => {
    expect(vercel.buildCommand).toBe('npm run export:web');
    expect(vercel.outputDirectory).toBe('dist');
    expect(vercel.framework).toBeNull();
  });

  it('o app mobile tem o script export:web e a saída web estática', () => {
    expect(pacote.scripts['export:web']).toBe('expo export -p web');
    expect(appJson.expo.web.output).toBe('static');
  });

  it('serve o manifest com o Content-Type correto e assets imutáveis em cache longo', () => {
    expect(valorDe('/manifest.json', 'Content-Type')).toBe('application/manifest+json');
    expect(valorDe('/_expo/static/(.*)', 'Cache-Control')).toContain('immutable');
  });

  it('aplica headers de segurança em todas as rotas', () => {
    expect(valorDe('/(.*)', 'X-Content-Type-Options')).toBe('nosniff');
    expect(valorDe('/(.*)', 'X-Frame-Options')).toBe('DENY');
    expect(valorDe('/(.*)', 'Referrer-Policy')).toBe('no-referrer');
    expect(valorDe('/(.*)', 'Permissions-Policy')).toBeDefined();
    expect(valorDe('/(.*)', 'Strict-Transport-Security')).toContain('max-age=');
  });

  it('faz fallback de SPA para /index.html', () => {
    expect(vercel.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('não versiona env nem URL da API e não usa analytics da Vercel (LGPD, $0)', () => {
    expect(vercel).not.toHaveProperty('env');
    expect(JSON.stringify(vercel)).not.toContain('EXPO_PUBLIC_API_URL');
    const deps = { ...pacote.dependencies, ...pacote.devDependencies };
    expect(deps).not.toHaveProperty('@vercel/analytics');
    expect(deps).not.toHaveProperty('@vercel/speed-insights');
  });
});
