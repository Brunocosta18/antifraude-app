import { describe, expect, it } from 'vitest';

import { analyzeMessageRules } from '../../../src/core/rules/message-analyzer.js';
import { COMBO_RULES, MESSAGE_RULES } from '../../../src/core/rules/message-rules.js';
import { normalizeForMatching, sanitizeText } from '../../../src/utils/text.js';

function ids(text: string): string[] {
  return analyzeMessageRules(normalizeForMatching(sanitizeText(text).text)).map((s) => s.id);
}

describe('regras de mensagem — um positivo e um negativo próximo por regra', () => {
  const cases: [string, string, string][] = [
    ['MSG-URUBU-PIX', 'Multiplique seu dinheiro com o urubu do Pix', 'Vou guardar meu dinheiro na poupança'],
    ['MSG-CODIGO-VERIFICACAO', 'Me passa o código de verificação do WhatsApp', 'Bom dia, o código do produto é 1234'],
    ['MSG-PEDIDO-CREDENCIAIS', 'Confirme sua senha para continuar', 'Esqueci minha senha do wifi, alguém lembra?'],
    ['MSG-FALSO-CORREIOS', 'Sua encomenda está retida, pague a taxa', 'Sua encomenda chegou, obrigado'],
    ['MSG-FALSO-GOV', 'Receita Federal: há uma pendência no seu nome', 'Entreguei a declaração na Receita Federal'],
    ['MSG-FALSA-CENTRAL', 'Central de segurança: compra suspeita, ligue já', 'A central de atendimento abre às 8h'],
    ['MSG-FALSO-PARENTE', 'Oi, troquei de número, salva esse número', 'Troquei de sofá ontem'],
    ['MSG-PREMIO-FALSO', 'Você ganhou um prêmio! Resgate agora', 'O prêmio foi para outro candidato'],
    ['MSG-EMPREGO-FALSO', 'Trabalhe de casa e ganhe dinheiro', 'Trabalhe com calma, sem pressa'],
    ['MSG-URGENCIA', 'Seu cartão será bloqueado, ultimo aviso', 'Almoço amanhã, sem pressa'],
    ['MSG-PEDIDO-PIX', 'Faz um Pix para a chave Pix abaixo', 'Gosto de pizza e de pão'],
  ];

  it.each(cases)('%s', (id, positive, negative) => {
    expect(ids(positive)).toContain(id);
    expect(ids(negative)).not.toContain(id);
  });

  it('toda regra da tabela tem caso de teste', () => {
    expect(new Set(cases.map(([id]) => id))).toEqual(new Set(MESSAGE_RULES.map((r) => r.id)));
  });
});

describe('regras de mensagem — detalhes', () => {
  it('"urgente" sozinho em contexto neutro não dispara urgência', () => {
    expect(ids('Preciso urgente de ajuda com a mudança')).not.toContain('MSG-URGENCIA');
  });

  it('"urgente" com contexto bancário dispara urgência', () => {
    expect(ids('URGENTE: regularize sua conta')).toContain('MSG-URGENCIA');
  });

  it('avisos legítimos ("nunca informe sua senha") não disparam', () => {
    expect(ids('Nunca informe sua senha a ninguém')).not.toContain('MSG-PEDIDO-CREDENCIAIS');
    expect(ids('Não envie o código de verificação do SMS para ninguém')).not.toContain('MSG-CODIGO-VERIFICACAO');
  });

  it('CPF cancelado dispara regra de governo sem outras palavras', () => {
    expect(ids('Seu CPF será cancelado')).toContain('MSG-FALSO-GOV');
  });

  it('caixa alta, acentos e caracteres invisíveis não burlam as regras', () => {
    expect(ids('URUBU DO PIX')).toContain('MSG-URUBU-PIX');
    expect(ids('Lucro garantido')).toContain('MSG-URUBU-PIX');
    expect(ids('LUCRO​ GARANTIDO')).toContain('MSG-URUBU-PIX');
    expect(ids('ÚLTIMO AVISO')).toContain('MSG-URGENCIA');
    expect(ids('código de verificação: me passa')).toContain('MSG-CODIGO-VERIFICACAO');
  });

  it('texto vazio não gera sinais', () => {
    expect(analyzeMessageRules('')).toEqual([]);
  });

  it('IDs são únicos e os pesos seguem a severidade ou o override', () => {
    const signals = analyzeMessageRules(
      normalizeForMatching('URGENTE conta bloqueada. Me passa o código de verificação do SMS, faz um pix'),
    );
    expect(new Set(signals.map((s) => s.id)).size).toBe(signals.length);
    const critical = signals.find((s) => s.id === 'MSG-CODIGO-VERIFICACAO');
    expect(critical?.weight).toBe(50);
  });

  it('regex rodam rápido em entradas patológicas', () => {
    const text = normalizeForMatching(`${'a '.repeat(2400)}pague ${'x'.repeat(100)} ate`);
    const started = Date.now();
    analyzeMessageRules(text);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('combinações', () => {
  it('COMBO-PARENTE-PIX: novo número + pedido de Pix', () => {
    const found = ids('Mudei de número, faz um pix pra mim');
    expect(found).toContain('COMBO-PARENTE-PIX');
  });

  it('COMBO-PARENTE-PIX não dispara sem o pedido de Pix', () => {
    expect(ids('Mudei de número, salva aí')).not.toContain('COMBO-PARENTE-PIX');
  });

  it('COMBO-URGENCIA-PAGAMENTO: urgência + pedido de Pix ou golpe de cobrança', () => {
    expect(ids('Último aviso: faça um pix agora')).toContain('COMBO-URGENCIA-PAGAMENTO');
    expect(ids('Último aviso: sua encomenda está retida, pague a taxa')).toContain('COMBO-URGENCIA-PAGAMENTO');
  });

  it('COMBO-URGENCIA-PAGAMENTO não dispara só com urgência', () => {
    expect(ids('Último aviso')).not.toContain('COMBO-URGENCIA-PAGAMENTO');
  });

  it('as combinações referenciam regras existentes', () => {
    const known = new Set(MESSAGE_RULES.map((r) => r.id));
    for (const combo of COMBO_RULES) {
      for (const id of [...combo.requires, ...(combo.requiresAny ?? [])]) expect(known.has(id)).toBe(true);
    }
  });
});
