import { normalizeForMatching, sanitizeText } from '../utils/text.js';
import { extractUrls, normalizeUrl, type Result, type UrlRejectionReason } from '../utils/url.js';
import { analyzeDomain } from './domain/domain-analyzer.js';
import { scoreSignals } from './risk/risk-scorer.js';
import { analyzeMessageRules } from './rules/message-analyzer.js';
import { DISCLAIMER, RISK_LABELS, type AnalysisReport, type Severity, type Signal } from './types.js';

/**
 * Orquestrador: junta regras de mensagem, heurísticas de domínio e o Risk Scorer.
 * Totalmente local e determinístico. Adaptadores externos (PhishTank, Safe Browsing, RDAP) poderão
 * produzir `Signal[]` extras que entram no mesmo `scoreSignals`; se falharem, a análise local continua.
 *
 * O relatório nunca contém o texto nem a URL originais (LGPD): só IDs e textos fixos das regras.
 */

const NO_INDICATORS_ADVICE =
  'Não encontramos sinais conhecidos de golpe, mas continue atento: confirme pedidos de pagamento por outro canal.';

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function dedupeSignals(signals: readonly Signal[]): Signal[] {
  const byId = new Map<string, Signal>();
  for (const signal of signals) {
    if (!byId.has(signal.id)) byId.set(signal.id, signal);
  }
  return [...byId.values()].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function buildReport(rawSignals: readonly Signal[]): AnalysisReport {
  const signals = dedupeSignals(rawSignals);
  const { level, score } = scoreSignals(signals);
  const advice = [...new Set(signals.map((s) => s.advice))];
  if (level === 'NO_KNOWN_INDICATORS') advice.unshift(NO_INDICATORS_ADVICE);
  return { level, label: RISK_LABELS[level], score, signals, advice, disclaimer: DISCLAIMER };
}

/** Analisa uma mensagem (texto livre). Nunca lança: entrada vazia ou inválida → nenhum indicador. */
export function analyzeMessage(input: unknown): AnalysisReport {
  try {
    const { text } = sanitizeText(input);
    const normalized = normalizeForMatching(text);
    const signals: Signal[] = analyzeMessageRules(normalized);

    for (const candidate of extractUrls(text)) {
      const url = normalizeUrl(candidate);
      if (!url.ok) continue; // local/privada/inválida: não é veredito sobre a mensagem
      signals.push(...analyzeDomain(url.value).signals);
    }
    return buildReport(signals);
  } catch {
    return buildReport([]);
  }
}

/** Analisa um link. URL inválida, local ou privada não é um veredito: devolve o motivo da rejeição. */
export function analyzeUrl(input: unknown): Result<AnalysisReport, UrlRejectionReason> {
  const url = normalizeUrl(input);
  if (!url.ok) return url;
  return { ok: true, value: buildReport(analyzeDomain(url.value).signals) };
}
