import { createHmac } from 'node:crypto';
import { getDomain } from 'tldts';

import { normalizeForMatching, sanitizeText } from '../../utils/text.js';
import { normalizeUrl } from '../../utils/url.js';
import type { FeedbackTargetType } from './types.js';

/**
 * Referência opaca (HMAC-SHA256 hex) do alvo analisado. Permite agregar feedbacks sem guardar o conteúdo.
 * URL: domínio registrável (variações do mesmo site agregam). Mensagem: texto normalizado.
 * URL inválida → `null`.
 */
export function computeTargetRef(secret: string, type: FeedbackTargetType, content: string): string | null {
  let input: string;
  if (type === 'url') {
    const normalized = normalizeUrl(content);
    if (!normalized.ok) return null;
    input = `url:${getDomain(normalized.value.hostname) ?? normalized.value.hostname}`;
  } else {
    input = `message:${normalizeForMatching(sanitizeText(content).text)}`;
  }
  return createHmac('sha256', secret).update(input).digest('hex');
}
