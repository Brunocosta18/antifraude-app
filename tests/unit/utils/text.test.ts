import { describe, expect, it } from 'vitest';

import { normalizeForMatching, removeInvisibleChars, sanitizeText } from '../../../src/utils/text.js';

describe('removeInvisibleChars', () => {
  it('remove byte nulo, controles e DEL', () => {
    expect(removeInvisibleChars('a\u0000b\u0007c\u007Fd\u009Be')).toBe('abcde');
  });

  it('remove overrides bidi (Trojan Source)', () => {
    expect(removeInvisibleChars('arquivo‮fdp.exe')).toBe('arquivofdp.exe');
    expect(removeInvisibleChars('⁦x⁩‎‏')).toBe('x');
  });

  it('remove caracteres de largura zero usados para burlar filtros', () => {
    expect(removeInvisibleChars('P​i‌x‍⁠﻿')).toBe('Pix');
    expect(removeInvisibleChars('ur­ubu')).toBe('urubu');
  });

  it('preserva quebra de linha, tab, acentos e emojis', () => {
    const input = 'Olá,\n\tação 🚨 já!';
    expect(removeInvisibleChars(input)).toBe(input);
  });
});

describe('sanitizeText', () => {
  it('limpa e normaliza um texto típico de golpe', () => {
    const result = sanitizeText('  Sua   conta​ será\r\nBLOQUEADA\n\n\n\nhoje!  ');

    expect(result).toEqual({ text: 'Sua conta será\nBLOQUEADA\n\nhoje!', truncated: false, removedCount: 1 });
  });

  it('aplica NFKC (fullwidth/compatibilidade → ASCII)', () => {
    expect(sanitizeText('ｐｉｘ ｇｒáｔｉｓ').text).toBe('pix grátis');
    expect(sanitizeText('ﬁnanceiro').text).toBe('financeiro');
  });

  it('converte espaços especiais (NBSP, ideográfico) em espaço simples', () => {
    expect(sanitizeText('taxa do　gov').text).toBe('taxa do gov');
  });

  it('trunca no limite e sinaliza', () => {
    const result = sanitizeText('a'.repeat(30), { maxLength: 10 });
    expect(result.text).toBe('a'.repeat(10));
    expect(result.truncated).toBe(true);
  });

  it('não corta um emoji pela metade na borda', () => {
    const result = sanitizeText('abc🚨def', { maxLength: 4 });
    expect(result.text).toBe('abc');
    expect(result.truncated).toBe(true);
  });

  it('limita entradas gigantes antes de processar', () => {
    const result = sanitizeText('x'.repeat(1_000_000), { maxLength: 100 });
    expect(result.text).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });

  it.each([undefined, null, 123, {}, ''])('retorna vazio para entrada inválida (%s)', (input) => {
    expect(sanitizeText(input)).toEqual({ text: '', truncated: false, removedCount: 0 });
  });

  it('texto só com invisíveis vira vazio', () => {
    expect(sanitizeText('​​ \u0000').text).toBe('');
  });
});

describe('normalizeForMatching', () => {
  it('remove acentos, caixa e espaços extras', () => {
    expect(normalizeForMatching('  Sua conta SERÁ   bloqueada — AÇÃO imediata ')).toBe(
      'sua conta sera bloqueada — acao imediata',
    );
  });

  it('é idempotente', () => {
    const once = normalizeForMatching('Pagamento NÃO identificado');
    expect(normalizeForMatching(once)).toBe(once);
  });
});
