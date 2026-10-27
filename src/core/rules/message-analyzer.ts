import { SEVERITY_WEIGHTS } from '../risk/risk-scorer.js';
import type { Signal } from '../types.js';
import { COMBO_RULES, MESSAGE_RULES, type Trigger } from './message-rules.js';

function triggerMatches(trigger: Trigger, text: string): boolean {
  return trigger.anyOf.some((re) => re.test(text)) && (trigger.allOf ?? []).every((re) => re.test(text));
}

/** Aplica as regras individuais e as combinações a um texto já normalizado. IDs únicos na saída. */
export function analyzeMessageRules(normalizedText: string): Signal[] {
  if (normalizedText.length === 0) return [];
  const signals: Signal[] = [];
  const fired = new Set<string>();

  for (const rule of MESSAGE_RULES) {
    if (!rule.triggers.some((t) => triggerMatches(t, normalizedText))) continue;
    if ((rule.noneOf ?? []).some((re) => re.test(normalizedText))) continue;
    fired.add(rule.id);
    signals.push({
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      weight: rule.weight ?? SEVERITY_WEIGHTS[rule.severity],
      title: rule.title,
      explanation: rule.explanation,
      advice: rule.advice,
    });
  }

  for (const combo of COMBO_RULES) {
    if (!combo.requires.every((id) => fired.has(id))) continue;
    if (combo.requiresAny && !combo.requiresAny.some((id) => fired.has(id))) continue;
    signals.push({
      id: combo.id,
      category: combo.category,
      severity: combo.severity,
      weight: combo.weight ?? SEVERITY_WEIGHTS[combo.severity],
      title: combo.title,
      explanation: combo.explanation,
      advice: combo.advice,
    });
  }

  return signals;
}
