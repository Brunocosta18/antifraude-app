import { describe, expect, it } from 'vitest';

import { isValidCnpj, isValidCpf, maskSensitiveData, maskUrl, passesLuhn } from '../../../src/utils/mask.js';

// Documentos fictícios, válidos apenas matematicamente.
const CPF_VALIDO = '52998224725';
const CPF_INVALIDO = '52998224726';
const CNPJ_VALIDO = '11222333000181';
const CARTAO_VALIDO = '4111 1111 1111 1111';
const CARTAO_INVALIDO = '4111 1111 1111 1112';

describe('validadores', () => {
  it('isValidCpf', () => {
    expect(isValidCpf(CPF_VALIDO)).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf(CPF_INVALIDO)).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('isValidCnpj', () => {
    expect(isValidCnpj(CNPJ_VALIDO)).toBe(true);
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('passesLuhn', () => {
    expect(passesLuhn(CARTAO_VALIDO)).toBe(true);
    expect(passesLuhn('5555555555554444')).toBe(true);
    expect(passesLuhn(CARTAO_INVALIDO)).toBe(false);
    expect(passesLuhn('1234')).toBe(false);
  });
});

describe('maskSensitiveData', () => {
  it('mascara CPF formatado e não formatado válido', () => {
    expect(maskSensitiveData('CPF: 529.982.247-25')).toEqual({ masked: 'CPF: [CPF]', found: { cpf: 1 } });
    expect(maskSensitiveData(`meu cpf ${CPF_VALIDO} ok`).masked).toBe('meu cpf [CPF] ok');
  });

  it('preserva sequência de 11 dígitos que não é CPF válido (ex.: protocolo)', () => {
    expect(maskSensitiveData(`protocolo ${CPF_INVALIDO}`).found.cpf).toBeUndefined();
  });

  it('mascara CNPJ formatado e não formatado válido', () => {
    expect(maskSensitiveData('CNPJ 11.222.333/0001-81').masked).toBe('CNPJ [CNPJ]');
    expect(maskSensitiveData(`cnpj ${CNPJ_VALIDO}`).masked).toBe('cnpj [CNPJ]');
  });

  it('mascara cartão válido no Luhn e preserva sequência inválida', () => {
    expect(maskSensitiveData(`cartão ${CARTAO_VALIDO} cvv`).masked).toBe('cartão [CARTAO] cvv');
    expect(maskSensitiveData('cartão 4111-1111-1111-1111').masked).toBe('cartão [CARTAO]');
    expect(maskSensitiveData(`número ${CARTAO_INVALIDO}`).found.card).toBeUndefined();
  });

  it('mascara e-mail', () => {
    expect(maskSensitiveData('fale com maria.silva+teste@exemplo.com.br hoje').masked).toBe('fale com [EMAIL] hoje');
  });

  it.each(['+55 (11) 91234-5678', '(11) 91234-5678', '11 91234 5678', '11912345678', '+5511912345678', '(21) 3333-4444'])(
    'mascara telefone %s',
    (phone) => {
      const result = maskSensitiveData(`ligue ${phone} agora`);
      expect(result.masked).toBe('ligue [TELEFONE] agora');
      expect(result.found).toEqual({ phone: 1 });
    },
  );

  it('mascara chave Pix aleatória (UUID)', () => {
    expect(maskSensitiveData('pix: 123e4567-e89b-12d3-a456-426614174000').masked).toBe('pix: [CHAVE_PIX]');
  });

  it.each([
    ['senha: 123abc', 'senha: [OCULTO]'],
    ['Senha=Abc@123!', 'Senha=[OCULTO]'],
    ['password: hunter2', 'password: [OCULTO]'],
    ['minha senha é segredo99', 'minha senha é [OCULTO]'],
    ['token=eyJhbGciOi.abc.def', 'token=[OCULTO]'],
    ['PIN: 4321', 'PIN: [OCULTO]'],
  ])('mascara credencial rotulada %j', (input, expected) => {
    expect(maskSensitiveData(input).masked).toBe(expected);
  });

  it('conta múltiplas ocorrências de tipos diferentes', () => {
    const text = `CPF 529.982.247-25, outro ${CPF_VALIDO}, email a@b.com, tel (11) 91234-5678, senha: x1`;
    const { masked, found } = maskSensitiveData(text);

    expect(found).toEqual({ cpf: 2, email: 1, phone: 1, credential: 1 });
    expect(masked).toBe('CPF [CPF], outro [CPF], email [EMAIL], tel [TELEFONE], senha: [OCULTO]');
  });

  it('não altera texto sem dados sensíveis', () => {
    const text = 'Parabéns! Você ganhou R$ 5.000,00. Pedido 2024/10 confirmado às 14:30.';
    expect(maskSensitiveData(text)).toEqual({ masked: text, found: {} });
  });

  it('não confunde palavras parecidas com rótulos de senha', () => {
    const text = 'passaporte: AB123456 e tokenizado: sim';
    expect(maskSensitiveData(text).masked).toBe(text);
  });
});

describe('maskUrl', () => {
  it('oculta credenciais embutidas', () => {
    expect(maskUrl('https://joao:segredo@golpe.xyz/login')).toBe('https://***@golpe.xyz/login');
  });

  it('oculta valores de parâmetros sensíveis e preserva os demais', () => {
    expect(maskUrl('https://golpe.xyz/pagar?valor=100&token=abc123&CPF=52998224725&ref=sms')).toBe(
      'https://golpe.xyz/pagar?valor=100&token=[OCULTO]&CPF=[OCULTO]&ref=sms',
    );
  });

  it('mascara dados pessoais no caminho', () => {
    expect(maskUrl('https://golpe.xyz/boleto/529.982.247-25')).toBe('https://golpe.xyz/boleto/[CPF]');
  });

  it('mascara texto não-URL sem lançar erro', () => {
    expect(maskUrl('não é url: a@b.com')).toBe('não é url: [EMAIL]');
  });

  it('mantém URL sem dados sensíveis intacta', () => {
    const url = 'https://exemplo.com.br/promo?utm_source=sms';
    expect(maskUrl(url)).toBe(url);
  });
});
