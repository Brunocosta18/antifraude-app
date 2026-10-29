/**
 * Validação local de chaves Pix (ANTIGOL-016). Roda só no aparelho: a chave nunca é enviada à API
 * nem guardada. `PixKeyCheck` descreve apenas tipo, status e motivos fixos — nunca a chave (LGPD).
 */

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'evp';
export type PixKeyStatus = 'invalid' | 'suspicious' | 'valid';
export type PixReason =
  | 'INVALID_FORMAT'
  | 'INVALID_CHECK_DIGITS'
  | 'SEQUENTIAL_DOCUMENT'
  | 'BRAND_IMPERSONATION'
  | 'FOREIGN_PHONE';

export interface PixKeyCheck {
  type: PixKeyType;
  status: PixKeyStatus;
  reasons: PixReason[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CPF_MASKED = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const CNPJ_MASKED = /^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-\d{2}$/i;
const CNPJ_PLAIN = /^[A-Z0-9]{12}\d{2}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 77; // limite do DICT

/** DDDs em uso no Brasil. */
const DDDS: ReadonlySet<string> = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

/** Cópia enxuta dos tokens de `src/core/domain/brands.ts` da API (o app é um pacote separado). */
const BRAND_TOKENS = [
  'itau', 'bancodobrasil', 'bradesco', 'santander', 'nubank', 'bancointer', 'c6bank', 'picpay',
  'mercadopago', 'mercadolivre', 'mercadolibre', 'correios', 'receitafederal', 'serasa', 'magalu',
  'magazineluiza', 'americanas', 'shopee', 'amazon', 'whatsapp', 'netflix', 'ifood',
];
/** Tokens curtos/comuns: só valem quando são um trecho inteiro do nome (separado por pontuação). */
const BRAND_EXACT_TOKENS: ReadonlySet<string> = new Set(['bb', 'caixa', 'inter', 'c6']);

const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.com.br', 'icloud.com', 'bol.com.br', 'uol.com.br', 'terra.com.br',
  'ig.com.br', 'protonmail.com', 'proton.me',
]);

/** Dígito/caractere → valor (ASCII − 48), regra do CNPJ alfanumérico. */
const charValue = (char: string): number => char.charCodeAt(0) - 48;

function checkDigit(chars: string, length: number, weights: (index: number) => number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += charValue(chars[i] as string) * weights(i);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const d1 = checkDigit(digits, 9, (i) => 10 - i);
  const d2 = checkDigit(digits, 10, (i) => 11 - i);
  return d1 === Number(digits[9]) && d2 === Number(digits[10]);
}

/** Aceita CNPJ numérico e alfanumérico (14 posições; os 2 DVs são numéricos). */
export function isValidCnpj(value: string): boolean {
  const chars = value.toUpperCase();
  if (!/^[A-Z0-9]{12}\d{2}$/.test(chars) || /^(.)\1{13}$/.test(chars)) return false;
  // Pesos 2 a 9 da direita para a esquerda, em ciclo.
  const d1 = checkDigit(chars, 12, (i) => ((11 - i) % 8) + 2);
  const d2 = checkDigit(chars, 13, (i) => ((12 - i) % 8) + 2);
  return d1 === Number(chars[12]) && d2 === Number(chars[13]);
}

/** Base do documento em sequência crescente ou decrescente (ex.: 123456789). */
function isSequential(base: string): boolean {
  const values = [...base].map(charValue);
  const diffs = values.slice(1).map((v, i) => (((v - (values[i] as number)) % 10) + 10) % 10);
  return diffs.every((d) => d === 1) || diffs.every((d) => d === 9);
}

function document(type: 'cpf' | 'cnpj', valid: boolean, base: string): PixKeyCheck {
  if (!valid) return { type, status: 'invalid', reasons: ['INVALID_CHECK_DIGITS'] };
  if (isSequential(base)) return { type, status: 'suspicious', reasons: ['SEQUENTIAL_DOCUMENT'] };
  return { type, status: 'valid', reasons: [] };
}

const result = (type: PixKeyType, status: PixKeyStatus, ...reasons: PixReason[]): PixKeyCheck => ({
  type,
  status,
  reasons,
});

function normalizeName(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function impersonatesBrand(localPart: string): boolean {
  const name = normalizeName(localPart);
  const compact = name.replace(/[^a-z0-9]/g, '');
  if (BRAND_TOKENS.some((token) => compact.includes(token))) return true;
  return name.split(/[^a-z0-9]+/).some((segment) => BRAND_EXACT_TOKENS.has(segment));
}

function checkEmail(input: string): PixKeyCheck {
  if (input.length > EMAIL_MAX_LENGTH || !EMAIL.test(input) || input.split('@').length !== 2) {
    return result('email', 'invalid', 'INVALID_FORMAT');
  }
  const [local, domain] = input.split('@') as [string, string];
  if (FREE_EMAIL_DOMAINS.has(domain.toLowerCase()) && impersonatesBrand(local)) {
    return result('email', 'suspicious', 'BRAND_IMPERSONATION');
  }
  return result('email', 'valid');
}

/** Telefone nacional (sem +55): DDD válido + 8 ou 9 dígitos (celular começa com 9). */
function isValidBrazilianNumber(national: string): boolean {
  if (!/^\d{10,11}$/.test(national) || !DDDS.has(national.slice(0, 2))) return false;
  const subscriber = national.slice(2);
  return subscriber.length === 9 ? subscriber.startsWith('9') : true;
}

function checkPlusPhone(input: string): PixKeyCheck | null {
  const digits = input.slice(1);
  if (!/^\d{8,15}$/.test(digits)) return result('phone', 'invalid', 'INVALID_FORMAT');
  if (digits.startsWith('55')) {
    return isValidBrazilianNumber(digits.slice(2))
      ? result('phone', 'valid')
      : result('phone', 'invalid', 'INVALID_FORMAT');
  }
  return result('phone', 'suspicious', 'FOREIGN_PHONE');
}

/**
 * Devolve `null` quando o texto não parece uma chave Pix (o fluxo de link/mensagem segue igual).
 * Só considera um token único, sem espaços.
 */
export function validatePixKey(input: string): PixKeyCheck | null {
  const text = input.trim();
  if (text === '' || /\s/.test(text)) return null;

  if (UUID.test(text)) return result('evp', 'valid');
  if (text.includes('@')) return checkEmail(text);
  if (text.startsWith('+')) return checkPlusPhone(text);

  if (CPF_MASKED.test(text)) {
    const digits = text.replace(/\D/g, '');
    return document('cpf', isValidCpf(digits), digits.slice(0, 9));
  }
  if (/^\d{11}$/.test(text)) {
    if (isValidCpf(text)) return document('cpf', true, text.slice(0, 9));
    // DV não bate, mas tem cara de celular (DDD válido + 9): trata como telefone.
    if (isValidBrazilianNumber(text) && text[2] === '9') return result('phone', 'valid');
    return document('cpf', false, text);
  }

  if (CNPJ_MASKED.test(text) || CNPJ_PLAIN.test(text)) {
    const chars = text.replace(/[./-]/g, '').toUpperCase();
    return document('cnpj', isValidCnpj(chars), chars.slice(0, 12));
  }
  return null;
}
