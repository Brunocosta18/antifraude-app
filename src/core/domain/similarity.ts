/**
 * Similaridade entre rótulos de domínio, para detectar imitações de marcas (typosquatting).
 */

/**
 * Distância de Damerau-Levenshtein (versão "optimal string alignment": inserção, remoção,
 * substituição e troca de letras adjacentes). Sai cedo e devolve `max + 1` quando a distância passa de `max`.
 */
export function damerauLevenshtein(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    const row: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        (prev[j] ?? 0) + 1, // remoção
        (row[j - 1] ?? 0) + 1, // inserção
        (prev[j - 1] ?? 0) + cost, // substituição
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, (prev2[j - 2] ?? 0) + 1); // troca de adjacentes
      }
      row.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  const distance = prev[b.length] ?? max + 1;
  return distance > max ? max + 1 : distance;
}

/** Letras de outras escritas visualmente idênticas a letras latinas. */
const HOMOGLYPHS: Record<string, string> = {
  // cirílico
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
  і: 'i', ї: 'i', ј: 'j', ѕ: 's', һ: 'h', ԁ: 'd', ԛ: 'q', ԝ: 'w',
  // grego
  α: 'a', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
  // latino com forma confundível
  ı: 'i', ɡ: 'g',
};

export type OneAs = 'l' | 'i';

/**
 * "Esqueleto" visual de um rótulo: minúsculas, sem diacríticos, com homóglifos cirílicos/gregos,
 * leet (`0→o`, `3→e`, `4→a`, `5→s`, `7→t`, `@→a`, `1→l` ou `i`), `rn→m`, `vv→w` e sem hífens.
 * O dígito `1` é ambíguo: use `oneAs` para escolher a leitura.
 */
export function skeleton(label: string, oneAs: OneAs = 'l'): string {
  const base = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

  let out = '';
  for (const ch of base) {
    const mapped = HOMOGLYPHS[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    switch (ch) {
      case '0':
        out += 'o';
        break;
      case '1':
        out += oneAs;
        break;
      case '3':
        out += 'e';
        break;
      case '4':
        out += 'a';
        break;
      case '5':
      case '$':
        out += 's';
        break;
      case '7':
        out += 't';
        break;
      case '@':
        out += 'a';
        break;
      case '-':
        break;
      default:
        out += ch;
    }
  }
  return out.replace(/rn/g, 'm').replace(/vv/g, 'w');
}
