/**
 * Sanitização e normalização de textos recebidos do usuário.
 *
 * Não escapa HTML: a codificação de saída é responsabilidade de quem renderiza.
 * Aqui removemos apenas o que é invisível ou perigoso em qualquer contexto.
 */

/**
 * Controles C0 (exceto `\t` e `\n`), DEL, C1, soft hyphen, zero-width,
 * marcas/overrides bidi (Trojan Source) e BOM.
 */
const INVISIBLE_CHARS =
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Espaços horizontais (inclui NBSP e espaços tipográficos). */
const HORIZONTAL_SPACES = /[ \t\f\v   -   　]+/g;

export const DEFAULT_TEXT_MAX_LENGTH = 5000;

export interface SanitizeTextOptions {
  maxLength?: number;
}

export interface SanitizedText {
  text: string;
  /** O texto foi cortado em `maxLength`. */
  truncated: boolean;
  /** Quantidade de caracteres invisíveis/de controle removidos (pode ser um sinal de ofuscação). */
  removedCount: number;
}

export function removeInvisibleChars(input: string): string {
  return input.replace(INVISIBLE_CHARS, '');
}

function countInvisibleChars(input: string): number {
  return input.match(INVISIBLE_CHARS)?.length ?? 0;
}

/** Corta em `maxLength` sem deixar metade de um par surrogate (ex.: emoji) no final. */
function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  let cut = input.slice(0, maxLength);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut.trimEnd();
}

export function sanitizeText(input: unknown, options: SanitizeTextOptions = {}): SanitizedText {
  const maxLength = options.maxLength ?? DEFAULT_TEXT_MAX_LENGTH;
  if (typeof input !== 'string' || input.length === 0) {
    return { text: '', truncated: false, removedCount: 0 };
  }

  // Limite bruto antes de qualquer processamento custoso (anti-DoS).
  const bounded = input.length > maxLength * 4 ? input.slice(0, maxLength * 4) : input;

  const normalized = bounded.normalize('NFKC').replace(/\r\n?/g, '\n');
  const removedCount = countInvisibleChars(normalized);

  const cleaned = removeInvisibleChars(normalized)
    .replace(HORIZONTAL_SPACES, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const text = truncate(cleaned, maxLength);
  return { text, truncated: text.length < cleaned.length || bounded !== input, removedCount };
}

/**
 * Forma canônica para casamento de regras: minúsculas, sem acentos e com espaços colapsados.
 * Ex.: "Sua conta será BLOQUEADA" → "sua conta sera bloqueada".
 */
export function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
