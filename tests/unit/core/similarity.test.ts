import { describe, expect, it } from 'vitest';

import { damerauLevenshtein, skeleton } from '../../../src/core/domain/similarity.js';

describe('damerauLevenshtein', () => {
  it.each([
    ['itau', 'itau', 0],
    ['itau', 'itao', 1], // substituição
    ['itau', 'itu', 1], // remoção
    ['itau', 'itaus', 1], // inserção
    ['itau', 'iatu', 1], // troca de adjacentes
    ['nubank', 'nubamk', 1],
    ['bradesco', 'bradesk0', 2],
    ['', 'abc', 3],
    ['abc', '', 3],
  ])('%s ↔ %s = %i', (a, b, expected) => {
    expect(damerauLevenshtein(a, b)).toBe(expected);
  });

  it('sai cedo devolvendo max + 1 quando a distância passa do limite', () => {
    expect(damerauLevenshtein('itau', 'completamente-diferente', 2)).toBe(3);
    expect(damerauLevenshtein('abcdef', 'uvwxyz', 1)).toBe(2);
    expect(damerauLevenshtein('itau', 'itao', 1)).toBe(1);
  });
});

describe('skeleton', () => {
  it.each([
    ['bradesc0', 'bradesco'],
    ['n0v4', 'nova'],
    ['p1cpay', 'plcpay'],
    ['@mazon', 'amazon'],
    ['nubarnk', 'nubamk'],
    ['vvhatsapp', 'whatsapp'],
    ['itaú', 'itau'],
    ['itau-app', 'itauapp'],
    ['ITAU', 'itau'],
  ])('%s → %s', (input, expected) => {
    expect(skeleton(input)).toBe(expected);
  });

  it('mapeia homóglifos cirílicos e gregos', () => {
    expect(skeleton('itаu')).toBe('itau'); // "а" cirílico
    expect(skeleton('рісраy')).toBe('picpay'); // "р", "і", "с" cirílicos
    expect(skeleton('ιtau')).toBe('itau'); // iota grego
    expect(skeleton('ο')).toBe('o'); // ômicron grego
  });

  it('o dígito 1 admite duas leituras', () => {
    expect(skeleton('1tau', 'i')).toBe('itau');
    expect(skeleton('1tau', 'l')).toBe('ltau');
  });
});
