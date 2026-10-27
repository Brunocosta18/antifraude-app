/**
 * Mascaramento de dados pessoais/sensíveis (LGPD — minimização e logs limpos).
 *
 * Mascarar ≠ analisar: a análise roda sobre o texto em memória; apenas a versão
 * mascarada pode ser logada ou persistida. As contagens em `found` servem como
 * sinal de risco ("a mensagem contém um CPF") sem guardar o dado em si.
 */

export type SensitiveKind = 'credential' | 'email' | 'pixKey' | 'card' | 'cnpj' | 'cpf' | 'phone';

export interface MaskResult {
  masked: string;
  found: Partial<Record<SensitiveKind, number>>;
}

const onlyDigits = (value: string): string => value.replace(/\D/g, '');
const allSameDigit = (digits: string): boolean => /^(\d)\1*$/.test(digits);

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || allSameDigit(digits)) return false;
  const nums = [...digits].map(Number);
  const checkDigit = (length: number): number => {
    const sum = nums.slice(0, length).reduce((acc, n, i) => acc + n * (length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return checkDigit(9) === nums[9] && checkDigit(10) === nums[10];
}

export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || allSameDigit(digits)) return false;
  const nums = [...digits].map(Number);
  const checkDigit = (length: number): number => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * (nums[i] ?? 0), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return checkDigit(12) === nums[12] && checkDigit(13) === nums[13];
}

export function passesLuhn(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

interface MaskRule {
  kind: SensitiveKind;
  pattern: RegExp;
  /** Retorna a substituição, ou `null` para manter o trecho original (falso positivo). */
  replace: (match: string, ...groups: string[]) => string | null;
}

const token = (label: string) => () => `[${label}]`;

/**
 * Ordem importa: do mais específico para o mais genérico.
 * Todas as regex são limitadas por lookarounds de dígito e sem quantificadores aninhados.
 */
const RULES: readonly MaskRule[] = [
  {
    kind: 'credential',
    pattern: /\b(senha|password|passwd|pwd|pass|token|pin)(\s*[:=]\s*|\s+(?:é|eh|is)\s+)([^\s&]+)/gi,
    replace: (_m, label, separator) => `${label}${separator}[OCULTO]`,
  },
  { kind: 'email', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, replace: token('EMAIL') },
  {
    kind: 'pixKey',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replace: token('CHAVE_PIX'),
  },
  {
    kind: 'card',
    pattern: /(?<!\d)(?:(?:\d{4}[ -]){2,4}\d{1,7}|\d{13,19})(?!\d)/g,
    replace: (m) => (passesLuhn(m) ? '[CARTAO]' : null),
  },
  { kind: 'cnpj', pattern: /(?<!\d)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?!\d)/g, replace: token('CNPJ') },
  { kind: 'cnpj', pattern: /(?<!\d)\d{14}(?!\d)/g, replace: (m) => (isValidCnpj(m) ? '[CNPJ]' : null) },
  { kind: 'cpf', pattern: /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g, replace: token('CPF') },
  { kind: 'cpf', pattern: /(?<!\d)\d{11}(?!\d)/g, replace: (m) => (isValidCpf(m) ? '[CPF]' : null) },
  {
    kind: 'phone',
    pattern: /(?<![\d+])(?:\+?55[ .-]?)?\(?[1-9]{2}\)?[ .-]?(?:9[ .-]?)?\d{4}[ .-]?\d{4}(?!\d)/g,
    replace: token('TELEFONE'),
  },
];

export function maskSensitiveData(text: string): MaskResult {
  const found: MaskResult['found'] = {};
  let masked = text;

  for (const rule of RULES) {
    masked = masked.replace(rule.pattern, (match: string, ...args: unknown[]) => {
      // Os dois últimos argumentos do callback são o offset e a string completa.
      const groups = args.slice(0, -2) as string[];
      const replacement = rule.replace(match, ...groups);
      if (replacement === null) return match;
      found[rule.kind] = (found[rule.kind] ?? 0) + 1;
      return replacement;
    });
  }

  return { masked, found };
}

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'senha',
  'password',
  'pass',
  'pwd',
  'key',
  'apikey',
  'api_key',
  'auth',
  'session',
  'sessionid',
  'sid',
  'code',
  'otp',
  'cpf',
  'cnpj',
  'email',
]);

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/**
 * Versão segura de uma URL para logs: remove `usuario:senha@`, oculta valores de
 * parâmetros sensíveis e aplica `maskSensitiveData` ao restante (ex.: CPF no caminho).
 */
export function maskUrl(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return maskSensitiveData(href).masked;
  }

  const userinfo = url.username !== '' || url.password !== '' ? '***@' : '';
  const query = url.search
    .slice(1)
    .split('&')
    .filter((part) => part !== '')
    .map((part) => {
      const [rawKey = ''] = part.split('=', 1);
      return SENSITIVE_QUERY_KEYS.has(safeDecode(rawKey).toLowerCase()) ? `${rawKey}=[OCULTO]` : part;
    })
    .join('&');

  const rebuilt = `${url.protocol}//${userinfo}${url.host}${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
  return maskSensitiveData(rebuilt).masked;
}
