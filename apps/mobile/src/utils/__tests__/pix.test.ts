import { isValidCnpj, isValidCpf, validatePixKey } from '../pix';

describe('isValidCpf', () => {
  it('aceita CPF com DV correto', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('12345678909')).toBe(true);
  });

  it('rejeita DV errado, tamanho errado e dígitos todos iguais', () => {
    expect(isValidCpf('52998224726')).toBe(false);
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('abcdefghijk')).toBe(false);
  });
});

describe('isValidCnpj', () => {
  it('aceita CNPJ numérico com DV correto', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('aceita CNPJ alfanumérico (exemplo oficial 12.ABC.345/01DE-35)', () => {
    expect(isValidCnpj('12ABC34501DE35')).toBe(true);
  });

  it('rejeita DV errado, tamanho errado e caracteres todos iguais', () => {
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('12ABC34501DE36')).toBe(false);
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });
});

describe('validatePixKey', () => {
  describe('não é chave Pix → null', () => {
    it.each([
      '',
      '   ',
      'https://exemplo.com.br/pagar',
      'exemplo.com.br',
      'Olá, faça um Pix para a conta que passei',
      'Pague agora 123 456',
      '12345',
    ])('%j', (input) => {
      expect(validatePixKey(input)).toBeNull();
    });
  });

  describe('CPF', () => {
    it('válido (com e sem máscara)', () => {
      expect(validatePixKey('529.982.247-25')).toEqual({ type: 'cpf', status: 'valid', reasons: [] });
      expect(validatePixKey('52998224725')).toEqual({ type: 'cpf', status: 'valid', reasons: [] });
    });

    it('DV errado → inválido', () => {
      expect(validatePixKey('529.982.247-26')).toEqual({
        type: 'cpf',
        status: 'invalid',
        reasons: ['INVALID_CHECK_DIGITS'],
      });
    });

    it('dígitos todos iguais → inválido', () => {
      expect(validatePixKey('111.111.111-11')).toMatchObject({ type: 'cpf', status: 'invalid' });
    });

    it('em sequência (123.456.789-09) → suspeito', () => {
      expect(validatePixKey('123.456.789-09')).toEqual({
        type: 'cpf',
        status: 'suspicious',
        reasons: ['SEQUENTIAL_DOCUMENT'],
      });
    });

    it('ambiguidade CPF × telefone: 11 dígitos com DDD válido + 9 e DV de CPF errado → telefone', () => {
      expect(validatePixKey('11987654321')).toEqual({ type: 'phone', status: 'valid', reasons: [] });
    });

    it('11 dígitos com DV errado e sem cara de celular → CPF inválido', () => {
      expect(validatePixKey('52998224726')).toMatchObject({ type: 'cpf', status: 'invalid' });
    });

    it('com máscara de CPF nunca vira telefone', () => {
      expect(validatePixKey('119.876.543-21')).toMatchObject({ type: 'cpf', status: 'invalid' });
    });
  });

  describe('CNPJ', () => {
    it('válido (máscara, sem máscara e alfanumérico)', () => {
      expect(validatePixKey('11.222.333/0001-81')).toEqual({ type: 'cnpj', status: 'valid', reasons: [] });
      expect(validatePixKey('11222333000181')).toEqual({ type: 'cnpj', status: 'valid', reasons: [] });
      expect(validatePixKey('12.ABC.345/01DE-35')).toEqual({ type: 'cnpj', status: 'valid', reasons: [] });
      expect(validatePixKey('12abc34501de35')).toEqual({ type: 'cnpj', status: 'valid', reasons: [] });
    });

    it('DV errado → inválido', () => {
      expect(validatePixKey('11.222.333/0001-82')).toEqual({
        type: 'cnpj',
        status: 'invalid',
        reasons: ['INVALID_CHECK_DIGITS'],
      });
    });

    it('em sequência → suspeito', () => {
      expect(validatePixKey('12.345.678/9012-30')).toEqual({
        type: 'cnpj',
        status: 'suspicious',
        reasons: ['SEQUENTIAL_DOCUMENT'],
      });
      expect(validatePixKey('98765432109874')).toMatchObject({ type: 'cnpj', status: 'suspicious' });
    });
  });

  describe('e-mail', () => {
    it('válido', () => {
      expect(validatePixKey('maria.souza@empresa.com.br')).toEqual({ type: 'email', status: 'valid', reasons: [] });
    });

    it('formato inválido', () => {
      expect(validatePixKey('maria@')).toEqual({ type: 'email', status: 'invalid', reasons: ['INVALID_FORMAT'] });
      expect(validatePixKey('@empresa.com')).toMatchObject({ type: 'email', status: 'invalid' });
      expect(validatePixKey('a@b')).toMatchObject({ type: 'email', status: 'invalid' });
    });

    it('acima de 77 caracteres → inválido', () => {
      const long = `${'a'.repeat(70)}@empresa.com`;
      expect(validatePixKey(long)).toMatchObject({ type: 'email', status: 'invalid' });
    });

    it('e-mail grátis que cita marca → suspeito', () => {
      expect(validatePixKey('suporte.nubank@gmail.com')).toEqual({
        type: 'email',
        status: 'suspicious',
        reasons: ['BRAND_IMPERSONATION'],
      });
      expect(validatePixKey('Atendimento_Itaú@hotmail.com')).toMatchObject({ status: 'suspicious' });
    });

    it('marca em domínio próprio não é suspeito', () => {
      expect(validatePixKey('contato@nubank.com.br')).toMatchObject({ status: 'valid' });
    });
  });

  describe('telefone', () => {
    it('+55 com DDD válido e 9 ou 8 dígitos', () => {
      expect(validatePixKey('+5511987654321')).toEqual({ type: 'phone', status: 'valid', reasons: [] });
      expect(validatePixKey('+551133334444')).toEqual({ type: 'phone', status: 'valid', reasons: [] });
    });

    it('+55 com DDD inexistente ou tamanho errado → inválido', () => {
      expect(validatePixKey('+5501987654321')).toMatchObject({ type: 'phone', status: 'invalid' });
      expect(validatePixKey('+55119876543')).toMatchObject({ type: 'phone', status: 'invalid' });
    });

    it('fora do +55 → suspeito', () => {
      expect(validatePixKey('+14155550123')).toEqual({
        type: 'phone',
        status: 'suspicious',
        reasons: ['FOREIGN_PHONE'],
      });
    });
  });

  describe('chave aleatória (EVP)', () => {
    it('UUID válido', () => {
      expect(validatePixKey('123e4567-e89b-12d3-a456-426614174000')).toEqual({
        type: 'evp',
        status: 'valid',
        reasons: [],
      });
    });
  });

  describe('LGPD', () => {
    it('o resultado nunca contém a chave digitada', () => {
      const keys = [
        '529.982.247-26',
        'suporte.nubank@gmail.com',
        '+14155550123',
        '123e4567-e89b-12d3-a456-426614174000',
        '11.222.333/0001-82',
      ];
      for (const key of keys) {
        const serialized = JSON.stringify(validatePixKey(key));
        expect(serialized).not.toContain(key);
        expect(serialized).not.toMatch(/nubank|gmail|4155550123|426614174000|529|222/);
      }
    });
  });
});
