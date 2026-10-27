import { domainToUnicode } from 'node:url';

import { parse } from 'tldts';

import { normalizeForMatching } from '../../utils/text.js';
import type { NormalizedUrl } from '../../utils/url.js';
import { SEVERITY_WEIGHTS } from '../risk/risk-scorer.js';
import type { Severity, Signal, SignalCategory } from '../types.js';
import { BRANDS, findOfficialBrand, type Brand } from './brands.js';
import { BAIT_REGEX, HIGH_RISK_TLDS, URL_SHORTENERS } from './domain-lists.js';
import { damerauLevenshtein, skeleton } from './similarity.js';

export interface DomainAnalysis {
  signals: Signal[];
  /** Nome da marca quando o domínio é oficial. Uso interno: não é garantia de segurança. */
  officialBrand: string | null;
}

interface SignalDef {
  category: SignalCategory;
  severity: Severity;
  weight?: number;
  title: string;
  explanation: string;
  advice: string;
}

const DEFS = {
  'DOM-TYPOSQUAT': {
    category: 'domain',
    severity: 'critical',
    title: 'Endereço parecido com o de uma marca conhecida',
    explanation: 'O nome do site imita uma marca famosa com letras trocadas, números ou símbolos para enganar.',
    advice: 'Não clique nem digite dados. Acesse a empresa pelo app oficial ou digitando o endereço correto.',
  },
  'DOM-MARCA-EMBUTIDA': {
    category: 'domain',
    severity: 'high',
    // Um pouco acima do peso padrão: junto com um sinal médio de outra categoria (ex.: TLD de risco) vira Alto Risco.
    weight: 40,
    title: 'Nome de marca dentro de um endereço que não é o oficial',
    explanation: 'O endereço usa o nome de uma marca, mas o site pertence a outro domínio. É uma tática comum de phishing.',
    advice: 'Confira o final do endereço, logo antes da primeira barra. Na dúvida, não abra o link.',
  },
  'DOM-GOV-FALSO': {
    category: 'domain',
    severity: 'critical',
    title: 'Falso endereço do governo',
    explanation: 'O endereço cita "gov.br", mas não termina em gov.br. Sites do governo brasileiro terminam em .gov.br.',
    advice: 'Não informe CPF nem dados. Consulte serviços públicos digitando gov.br no navegador.',
  },
  'DOM-HOMOGRAFO': {
    category: 'domain',
    severity: 'critical',
    title: 'Endereço com letras disfarçadas',
    explanation: 'O endereço usa letras de outros alfabetos que parecem as nossas para imitar uma marca.',
    advice: 'Não clique. Digite o endereço oficial você mesmo ou use o app da empresa.',
  },
  'DOM-IDN': {
    category: 'domain',
    severity: 'low',
    title: 'Endereço com caracteres especiais',
    explanation: 'Endereços com acentos ou letras estrangeiras podem esconder imitações.',
    advice: 'Desconfie se o link veio de uma mensagem inesperada.',
  },
  'DOM-TLD-ALTO-RISCO': {
    category: 'url_structure',
    severity: 'medium',
    title: 'Final de endereço muito usado em golpes',
    explanation: 'Terminações como .xyz, .top e .online são baratas e muito usadas em sites falsos.',
    advice: 'Evite informar dados ou pagar em sites com essa terminação sem confirmar a origem.',
  },
  'URL-CREDENCIAIS': {
    category: 'url_structure',
    severity: 'critical',
    title: 'Link com "usuário@" para enganar',
    explanation: 'Tudo o que vem antes do @ é ignorado: o link parece ir para um site conhecido, mas leva para outro.',
    advice: 'Não abra. Links legítimos não usam @ no endereço.',
  },
  'URL-IP-LITERAL': {
    category: 'url_structure',
    severity: 'high',
    title: 'Link com número no lugar do nome do site',
    explanation: 'Empresas sérias usam nomes, não números de IP. Isso é comum em páginas falsas temporárias.',
    advice: 'Não informe dados nem faça pagamentos nesse endereço.',
  },
  'URL-ENCURTADOR': {
    category: 'url_structure',
    severity: 'medium',
    title: 'Link encurtado',
    explanation: 'Links encurtados escondem o destino real, e não dá para saber para onde levam antes de abrir.',
    advice: 'Peça o link completo ao remetente por outro canal antes de abrir.',
  },
  'URL-SEM-HTTPS': {
    category: 'url_structure',
    severity: 'low',
    title: 'Conexão sem criptografia (http)',
    explanation: 'O link não usa HTTPS, então os dados enviados podem ser interceptados. Ter HTTPS, porém, não garante nada.',
    advice: 'Evite digitar dados pessoais ou de pagamento em endereços http.',
  },
  'URL-PORTA-INCOMUM': {
    category: 'url_structure',
    severity: 'low',
    title: 'Porta incomum no endereço',
    explanation: 'Sites comuns não precisam de número de porta no endereço.',
    advice: 'Desconfie de links com ":" e números depois do nome do site.',
  },
  'URL-PALAVRA-ISCA': {
    category: 'url_structure',
    severity: 'low',
    title: 'Palavras típicas de golpe no link',
    explanation: 'Termos como "login", "atualiza", "pix" ou "taxa" no endereço são usados para passar confiança.',
    advice: 'Confira se o endereço realmente pertence à empresa citada.',
  },
  'DOM-ESTRUTURA-SUSPEITA': {
    category: 'url_structure',
    severity: 'low',
    title: 'Endereço com estrutura estranha',
    explanation: 'Endereços muito longos, com muitos pontos ou hífens servem para esconder o domínio verdadeiro.',
    advice: 'Olhe o trecho final do endereço, antes da primeira barra: ele é quem manda.',
  },
} as const satisfies Record<string, SignalDef>;

type SignalId = keyof typeof DEFS;

function make(id: SignalId): Signal {
  const def: SignalDef = DEFS[id];
  return {
    id,
    category: def.category,
    severity: def.severity,
    weight: def.weight ?? SEVERITY_WEIGHTS[def.severity],
    title: def.title,
    explanation: def.explanation,
    advice: def.advice,
  };
}

const MIN_FUZZY_TOKEN_LENGTH = 4;
const SHORT_TOKEN_MAX = 6;

type MatchKind = 'exact' | 'skeleton' | 'fuzzy';

/** Compara um candidato (rótulo ou parte com hífen, em Unicode e minúsculas) com os tokens de uma marca. */
function matchBrandToken(candidate: string, brand: Brand): MatchKind | null {
  if ((brand.exactOnly ?? []).includes(candidate)) return 'exact';
  const skeletons = [...new Set([skeleton(candidate, 'l'), skeleton(candidate, 'i')])];

  for (const token of brand.tokens) {
    if (candidate === token) return 'exact';
    if (skeletons.includes(token)) return 'skeleton';
    if (token.length < MIN_FUZZY_TOKEN_LENGTH) continue;
    const max = token.length <= SHORT_TOKEN_MAX ? 1 : 2;
    for (const sk of skeletons) {
      if (sk.length >= MIN_FUZZY_TOKEN_LENGTH && damerauLevenshtein(sk, token, max) <= max) return 'fuzzy';
    }
  }
  return null;
}

interface LabelMatch {
  /** Parte separada por hífen que é exatamente o token da marca (ou o rótulo inteiro, se for token exato curto). */
  embedded: boolean;
  /** Imitação: skeleton igual ou distância pequena. */
  imitation: boolean;
}

/** Analisa o rótulo registrável: rótulo inteiro e cada parte separada por hífen. */
function matchRegistrableLabel(label: string): LabelMatch {
  const result: LabelMatch = { embedded: false, imitation: false };
  const hasHyphen = label.includes('-');
  const whole = BRANDS.map((brand) => matchBrandToken(label, brand));

  for (const [index, kind] of whole.entries()) {
    if (kind === null) continue;
    const brand = BRANDS[index];
    const isShortExact = kind === 'exact' && !!brand && (brand.exactOnly ?? []).includes(label);
    // Marca curta/ambígua igual ao rótulo (ex.: `inter.xyz`) é só "marca embutida"; as demais são imitação.
    if (isShortExact) result.embedded = true;
    else result.imitation = true;
  }

  if (hasHyphen) {
    for (const part of label.split('-').filter((p) => p.length > 0)) {
      for (const brand of BRANDS) {
        const kind = matchBrandToken(part, brand);
        if (kind === 'exact') result.embedded = true;
        else if (kind !== null) result.imitation = true;
      }
    }
  }
  return result;
}

/** Marca citada num rótulo de subdomínio (inteiro, parte com hífen, ou trecho de tokens longos). */
function subdomainMentionsBrand(subdomain: string): boolean {
  for (const label of subdomain.split('.')) {
    const parts = [label, ...label.split('-')];
    for (const brand of BRANDS) {
      const exactTokens = [...brand.tokens, ...(brand.exactOnly ?? [])];
      if (parts.some((p) => exactTokens.includes(p))) return true;
      if (brand.tokens.some((t) => t.length >= 5 && label.includes(t))) return true;
    }
  }
  return false;
}

const GOV_BR_IN_HOST = /(?:^|[.-])gov[.-]?br(?=[.-]|$)/;

function unicodeLabel(asciiLabel: string): string {
  return asciiLabel.startsWith('xn--') ? domainToUnicode(asciiLabel) || asciiLabel : asciiLabel;
}

function isMixedScript(label: string): boolean {
  return /\p{Script=Latin}/u.test(label) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(label);
}

function decodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** Heurísticas locais de domínio e estrutura de URL. Sem rede. */
export function analyzeDomain(url: NormalizedUrl): DomainAnalysis {
  const signals: Signal[] = [];
  const add = (id: SignalId): void => {
    signals.push(make(id));
  };

  // Estrutura da URL (vale também para domínios oficiais e IPs).
  if (url.hadCredentials) add('URL-CREDENCIAIS');
  if (url.isIpLiteral) add('URL-IP-LITERAL');
  if (url.protocol === 'http:' && !url.schemeInferred) add('URL-SEM-HTTPS');
  if (url.port !== null) add('URL-PORTA-INCOMUM');

  const hostname = url.hostname;
  const officialBrand = url.isIpLiteral ? null : findOfficialBrand(hostname);

  const baitText = normalizeForMatching(`${url.isIpLiteral ? '' : url.hostnameUnicode} ${decodePath(url.pathname)}`);
  if (BAIT_REGEX.test(baitText)) add('URL-PALAVRA-ISCA');

  if (url.isIpLiteral) return { signals, officialBrand: null };

  const parsed = parse(hostname);
  const domain = parsed.domain ?? hostname;
  const subdomain = parsed.subdomain ?? '';
  const registrableAscii = parsed.domainWithoutSuffix ?? '';
  const labelsAscii = hostname.split('.');
  const tld = labelsAscii[labelsAscii.length - 1] ?? '';

  if (URL_SHORTENERS.some((s) => domain === s)) add('URL-ENCURTADOR');
  if (HIGH_RISK_TLDS.has(tld)) add('DOM-TLD-ALTO-RISCO');

  const hyphenCount = (registrableAscii.match(/-/g) ?? []).length;
  const subdomainLevels = subdomain === '' ? 0 : subdomain.split('.').length;
  if (subdomainLevels >= 4 || hostname.length > 50 || hyphenCount >= 2) add('DOM-ESTRUTURA-SUSPEITA');

  if (officialBrand !== null) return { signals, officialBrand };

  // Falso gov.br: cita gov.br mas não termina em gov.br (oficial já retornou acima).
  if (GOV_BR_IN_HOST.test(hostname)) add('DOM-GOV-FALSO');

  // Marcas: operam sobre rótulos em Unicode (para ver letras disfarçadas).
  const registrableLabel = unicodeLabel(registrableAscii);
  const subdomainUnicode = subdomain.split('.').filter(Boolean).map(unicodeLabel).join('.');

  const allUnicodeLabels = labelsAscii.map(unicodeLabel);
  const hasPunycode = labelsAscii.some((l) => l.startsWith('xn--'));
  const registrableMatch = matchRegistrableLabel(registrableLabel);

  let homograph = false;
  if (hasPunycode) {
    const idnLabels = allUnicodeLabels.filter((_, i) => labelsAscii[i]?.startsWith('xn--'));
    homograph = idnLabels.some((l) => isMixedScript(l)) || registrableMatch.imitation || registrableMatch.embedded;
    // Também confere os rótulos IDN de subdomínio contra as marcas.
    if (!homograph) {
      homograph = idnLabels.some((l) => matchRegistrableLabel(l).imitation);
    }
    if (homograph) add('DOM-HOMOGRAFO');
    else add('DOM-IDN');
  }

  if (!homograph && registrableMatch.imitation) add('DOM-TYPOSQUAT');
  if (!homograph && (registrableMatch.embedded || subdomainMentionsBrand(subdomainUnicode))) {
    add('DOM-MARCA-EMBUTIDA');
  }

  return { signals, officialBrand: null };
}
