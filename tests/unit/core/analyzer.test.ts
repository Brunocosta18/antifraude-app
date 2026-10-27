import { describe, expect, it } from 'vitest';

import { analyzeMessage, analyzeUrl } from '../../../src/core/analyzer.js';
import type { AnalysisReport, RiskLevel } from '../../../src/core/types.js';
import { LEGIT_MESSAGES, SCAM_MESSAGES } from '../../fixtures/messages.js';
import { LEGIT_URLS, SCAM_URLS } from '../../fixtures/urls.js';

const ORDER: Record<RiskLevel, number> = { NO_KNOWN_INDICATORS: 0, NEEDS_ATTENTION: 1, HIGH_RISK: 2 };

function expectAtLeast(actual: RiskLevel, expected: RiskLevel): void {
  expect(ORDER[actual], `nível ${actual}, esperado pelo menos ${expected}`).toBeGreaterThanOrEqual(ORDER[expected]);
}

function urlReport(input: string): AnalysisReport {
  const result = analyzeUrl(input);
  if (!result.ok) throw new Error(`URL rejeitada: ${result.reason}`);
  return result.value;
}

const ids = (report: AnalysisReport): string[] => report.signals.map((s) => s.id);

describe('analyzeMessage — golpes', () => {
  it.each(SCAM_MESSAGES)('$name', ({ text, expectedLevel, expectedSignals }) => {
    const report = analyzeMessage(text);
    expectAtLeast(report.level, expectedLevel);
    for (const id of expectedSignals) expect(ids(report)).toContain(id);
  });
});

describe('analyzeMessage — mensagens legítimas', () => {
  it.each(LEGIT_MESSAGES)('$name', ({ text }) => {
    const report = analyzeMessage(text);
    expect(report.level).toBe('NO_KNOWN_INDICATORS');
  });
});

describe('analyzeMessage — links dentro da mensagem', () => {
  it('soma os sinais do link aos da mensagem', () => {
    const withoutLink = analyzeMessage('Pague a taxa dos Correios');
    const withLink = analyzeMessage('Pague a taxa dos Correios em correios-rastreio.online/taxa');
    expect(ids(withoutLink)).not.toContain('DOM-MARCA-EMBUTIDA');
    expect(ids(withLink)).toContain('DOM-MARCA-EMBUTIDA');
    expect(withLink.score).toBeGreaterThan(withoutLink.score);
  });

  it('ignora links locais ou privados', () => {
    const report = analyzeMessage('veja http://localhost:3000/teste e http://192.168.0.1/admin');
    expect(report.level).toBe('NO_KNOWN_INDICATORS');
  });
});

describe('analyzeMessage — entradas inválidas', () => {
  it.each([[''], [undefined], [null], [123], [{}], [['a']], ['   \n\t ']])('%j → nenhum indicador, sem erro', (input) => {
    const report = analyzeMessage(input);
    expect(report.level).toBe('NO_KNOWN_INDICATORS');
    expect(report.signals).toEqual([]);
    expect(report.score).toBe(0);
  });

  it('texto gigante termina rápido e sem erro', () => {
    const started = Date.now();
    const report = analyzeMessage('a'.repeat(200_000) + ' urubu do pix');
    expect(report.level).toBeDefined();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('analyzeUrl', () => {
  it.each(SCAM_URLS)('golpe: $url', ({ url, expectedLevel, expectedSignals }) => {
    const report = urlReport(url);
    expectAtLeast(report.level, expectedLevel);
    for (const id of expectedSignals) expect(ids(report)).toContain(id);
  });

  it.each(LEGIT_URLS)('legítima: %s', (url) => {
    expect(urlReport(url).level).toBe('NO_KNOWN_INDICATORS');
  });

  it.each(['http://localhost', 'http://127.0.0.1', 'http://192.168.0.10/x', '', 'ftp://exemplo.com', 123])(
    'rejeita %j sem dar veredito',
    (input) => {
      expect(analyzeUrl(input).ok).toBe(false);
    },
  );

  it('localhost retorna o motivo', () => {
    expect(analyzeUrl('localhost')).toEqual({ ok: false, reason: 'LOCAL_HOSTNAME' });
  });
});

describe('guardas de produto', () => {
  const reports: AnalysisReport[] = [
    ...SCAM_MESSAGES.map((f) => analyzeMessage(f.text)),
    ...LEGIT_MESSAGES.map((f) => analyzeMessage(f.text)),
    ...SCAM_URLS.map((f) => urlReport(f.url)),
    ...LEGIT_URLS.map((u) => urlReport(u)),
    analyzeMessage(''),
  ];

  it('nunca afirma que algo é seguro', () => {
    for (const report of reports) {
      const text = JSON.stringify(report).toLowerCase();
      expect(text).not.toMatch(/\bseguro\b|\bsegura\b/);
      expect(text).not.toContain('100% seguro');
    }
  });

  it('usa só os rótulos oficiais e inclui o disclaimer', () => {
    const labels = new Set(['Alto Risco', 'Requer Atenção', 'Nenhum Indicador Conhecido Encontrado']);
    for (const report of reports) {
      expect(labels.has(report.label)).toBe(true);
      expect(report.disclaimer).toContain('não é 100% infalível');
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    }
  });

  it('nível "nenhum indicador" traz orientação de continuar atento', () => {
    const report = analyzeMessage('Reunião amanhã às 10h');
    expect(report.advice[0]).toContain('continue atento');
  });

  it('o relatório não contém trechos da entrada (LGPD)', () => {
    const secrets = ['123.456.789-09', '+55 11 91234-5678', 'segredo-do-usuario.xyz', 'Maria da Silva'];
    const report = analyzeMessage(
      `Maria da Silva, seu CPF 123.456.789-09 será cancelado. Ligue +55 11 91234-5678 ou acesse segredo-do-usuario.xyz`,
    );
    const dump = JSON.stringify(report);
    for (const secret of secrets) expect(dump).not.toContain(secret);
    expect(report.signals.length).toBeGreaterThan(0);

    const url = urlReport('https://segredo-do-usuario.xyz/token=abc123');
    expect(JSON.stringify(url)).not.toContain('segredo-do-usuario');
    expect(JSON.stringify(url)).not.toContain('abc123');
  });

  it('é determinístico e não repete IDs de sinais', () => {
    const text = SCAM_MESSAGES[0]?.text ?? '';
    expect(analyzeMessage(text)).toEqual(analyzeMessage(text));
    for (const report of reports) expect(new Set(ids(report)).size).toBe(report.signals.length);
  });
});
