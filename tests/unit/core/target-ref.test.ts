import { describe, expect, it } from 'vitest';

import { computeTargetRef } from '../../../src/core/feedback/target-ref.js';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';

describe('computeTargetRef', () => {
  it('é determinística e tem 64 caracteres hex', () => {
    const a = computeTargetRef(SECRET, 'message', 'Sua conta será bloqueada');
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(computeTargetRef(SECRET, 'message', 'Sua conta será bloqueada')).toBe(a);
  });

  it('segredo diferente gera ref diferente', () => {
    expect(computeTargetRef(SECRET, 'message', 'oi')).not.toBe(computeTargetRef(`${SECRET}-outro`, 'message', 'oi'));
  });

  it('mensagens equivalentes (caixa, acento, espaços) agregam na mesma ref', () => {
    expect(computeTargetRef(SECRET, 'message', 'Sua  CONTA será bloqueada')).toBe(
      computeTargetRef(SECRET, 'message', 'sua conta sera bloqueada'),
    );
  });

  it('variações do mesmo site agregam na mesma ref', () => {
    expect(computeTargetRef(SECRET, 'url', 'https://www.x.com.br/a')).toBe(computeTargetRef(SECRET, 'url', 'http://x.com.br/b'));
  });

  it('sites diferentes e tipos diferentes têm refs diferentes', () => {
    expect(computeTargetRef(SECRET, 'url', 'https://x.com.br')).not.toBe(computeTargetRef(SECRET, 'url', 'https://y.com.br'));
    expect(computeTargetRef(SECRET, 'url', 'https://x.com.br')).not.toBe(computeTargetRef(SECRET, 'message', 'x.com.br'));
  });

  it('URL inválida devolve null', () => {
    expect(computeTargetRef(SECRET, 'url', 'ftp://x.com')).toBeNull();
  });

  it('não contém o conteúdo de entrada', () => {
    const ref = computeTargetRef(SECRET, 'url', 'https://exemplo-sigiloso.com.br');
    expect(ref).not.toContain('exemplo');
  });
});
