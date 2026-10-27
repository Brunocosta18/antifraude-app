/**
 * Marcas mais imitadas em golpes no Brasil.
 * `tokens`: nomes em minúsculas, sem acento, sem espaços nem hífens.
 * `exactOnly`: tokens curtos ou comuns demais para comparação aproximada (`inter`, `bb`, `c6`):
 * só valem quando o rótulo (ou parte separada por hífen) é exatamente igual.
 * `officialDomains`: o domínio e todos os seus subdomínios são considerados oficiais.
 */
export interface Brand {
  name: string;
  tokens: string[];
  exactOnly?: string[];
  officialDomains: string[];
}

export const BRANDS: readonly Brand[] = [
  { name: 'Itaú', tokens: ['itau'], officialDomains: ['itau.com.br', 'itau.com', 'itaucard.com.br'] },
  {
    name: 'Banco do Brasil',
    tokens: ['bancodobrasil'],
    exactOnly: ['bb'],
    officialDomains: ['bb.com.br', 'bancodobrasil.com.br'],
  },
  { name: 'Caixa', tokens: [], exactOnly: ['caixa'], officialDomains: ['caixa.gov.br'] },
  {
    name: 'Bradesco',
    tokens: ['bradesco'],
    officialDomains: ['bradesco.com.br', 'bradescoseguros.com.br', 'bradescard.com.br'],
  },
  { name: 'Santander', tokens: ['santander'], officialDomains: ['santander.com.br', 'santander.com'] },
  { name: 'Nubank', tokens: ['nubank'], officialDomains: ['nubank.com.br', 'nu.com.br'] },
  { name: 'Inter', tokens: ['bancointer'], exactOnly: ['inter'], officialDomains: ['inter.co', 'bancointer.com.br'] },
  { name: 'C6 Bank', tokens: ['c6bank'], exactOnly: ['c6'], officialDomains: ['c6bank.com.br', 'c6bank.com'] },
  { name: 'PicPay', tokens: ['picpay'], officialDomains: ['picpay.com'] },
  {
    name: 'Mercado Pago',
    tokens: ['mercadopago'],
    officialDomains: ['mercadopago.com.br', 'mercadopago.com'],
  },
  {
    name: 'Mercado Livre',
    tokens: ['mercadolivre', 'mercadolibre'],
    officialDomains: ['mercadolivre.com.br', 'mercadolivre.com', 'mercadolibre.com'],
  },
  { name: 'Correios', tokens: ['correios'], officialDomains: ['correios.com.br'] },
  { name: 'Governo (gov.br / Receita Federal)', tokens: ['receitafederal'], officialDomains: ['gov.br'] },
  { name: 'Serasa', tokens: ['serasa'], officialDomains: ['serasa.com.br', 'serasaexperian.com.br'] },
  { name: 'Magalu', tokens: ['magalu', 'magazineluiza'], officialDomains: ['magazineluiza.com.br', 'magalu.com'] },
  { name: 'Americanas', tokens: ['americanas'], officialDomains: ['americanas.com.br'] },
  { name: 'Shopee', tokens: ['shopee'], officialDomains: ['shopee.com.br', 'shopee.com'] },
  { name: 'Amazon', tokens: ['amazon'], officialDomains: ['amazon.com.br', 'amazon.com'] },
  { name: 'WhatsApp', tokens: ['whatsapp'], officialDomains: ['whatsapp.com', 'whatsapp.net', 'wa.me'] },
  { name: 'Netflix', tokens: ['netflix'], officialDomains: ['netflix.com'] },
  { name: 'iFood', tokens: ['ifood'], officialDomains: ['ifood.com.br'] },
];

/** Qualquer `*.gov.br` é do governo e conta como oficial. */
export const GOV_BR_SUFFIX = 'gov.br';

function isSameOrSubdomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Nome da marca dona do domínio oficial, ou `null`. */
export function findOfficialBrand(hostname: string): string | null {
  for (const brand of BRANDS) {
    if (brand.officialDomains.some((d) => isSameOrSubdomain(hostname, d))) return brand.name;
  }
  if (isSameOrSubdomain(hostname, GOV_BR_SUFFIX)) return 'Governo (gov.br / Receita Federal)';
  return null;
}
