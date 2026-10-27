/** TLDs muito usados em golpes (baratos e com pouca verificação). */
export const HIGH_RISK_TLDS: ReadonlySet<string> = new Set([
  'xyz', 'top', 'click', 'online', 'site', 'icu', 'buzz', 'live', 'shop', 'store', 'cyou', 'rest', 'monster',
  'cfd', 'sbs', 'link', 'club', 'vip', 'lat', 'bond', 'quest', 'win', 'loan', 'work', 'support', 'help', 'digital',
]);

/** Encurtadores: escondem o destino real do link. */
export const URL_SHORTENERS: readonly string[] = [
  'bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'rebrand.ly', 'shorturl.at', 'tiny.cc', 's.id',
  'encurtador.com.br', 'l1nk.dev', 't.ly', 'u.to',
];

/** Palavras-isca que casam só no início de uma palavra do host/caminho (`atualiza` → `atualizacao`). */
export const BAIT_STEMS: readonly string[] = ['atualiza', 'seguranca', 'desbloque', 'regulariza', 'acesso', 'resgat'];

/** Palavras-isca que precisam ser a palavra inteira (evita `pixar`, `taxas` etc.). */
export const BAIT_WORDS: readonly string[] = ['login', 'token', 'premio', 'pix', 'boleto', '2via', 'rastreio', 'taxa', 'receita'];

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Casa uma palavra-isca em texto normalizado (host e caminho já sem acento). */
export const BAIT_REGEX = new RegExp(
  `(?<![a-z0-9])(?:(?:${BAIT_STEMS.map(escape).join('|')})|(?:${BAIT_WORDS.map(escape).join('|')})(?![a-z0-9]))`,
);
