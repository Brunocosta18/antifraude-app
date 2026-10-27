import { describe, expect, it } from 'vitest';

import { analyzeDomain } from '../../../src/core/domain/domain-analyzer.js';
import { normalizeUrl } from '../../../src/utils/url.js';

function analyze(input: string) {
  const result = normalizeUrl(input);
  if (!result.ok) throw new Error(`URL rejeitada: ${result.reason}`);
  return analyzeDomain(result.value);
}

const ids = (input: string): string[] => analyze(input).signals.map((s) => s.id);

describe('DOM-TYPOSQUAT', () => {
  it.each([
    'https://bradesc0.com.br', // leet
    'https://nubamk.com', // substituição
    'https://santnader.com', // troca de adjacentes
    'https://mercado-pago.com', // hífen entre palavras da marca
    'https://nubank.net', // marca igual, domínio não oficial
    'https://shopeee.com.br', // letra repetida
  ])('detecta %s', (url) => {
    expect(ids(url)).toContain('DOM-TYPOSQUAT');
  });

  it('é crítico', () => {
    expect(analyze('https://bradesc0.com.br').signals.find((s) => s.id === 'DOM-TYPOSQUAT')?.severity).toBe('critical');
  });
});

describe('DOM-MARCA-EMBUTIDA', () => {
  it.each([
    'https://itau-seguranca.com',
    'https://bradesco.atualizacao.xyz',
    'https://www.itau.com.br.golpe.xyz',
    'https://login.nubank.golpe.com.br',
    'https://inter-app.com',
  ])('detecta %s', (url) => {
    expect(ids(url)).toContain('DOM-MARCA-EMBUTIDA');
  });
});

describe('DOM-GOV-FALSO', () => {
  it.each(['https://gov.br.regularizar.top', 'https://receita-gov-br.com', 'https://caixa.gov.br.atendimento.top', 'https://govbr.site'])(
    'detecta %s',
    (url) => {
      expect(ids(url)).toContain('DOM-GOV-FALSO');
    },
  );
});

describe('DOM-HOMOGRAFO e DOM-IDN', () => {
  it('cirílico imitando marca é homógrafo (não typosquat duplicado)', () => {
    const found = ids('https://itаu.com.br'); // "а" cirílico
    expect(found).toContain('DOM-HOMOGRAFO');
    expect(found).not.toContain('DOM-TYPOSQUAT');
  });

  it('mistura de escritas é homógrafo mesmo sem marca', () => {
    expect(ids('https://exemplоs.com')).toContain('DOM-HOMOGRAFO'); // "о" cirílico
  });

  it('IDN legítimo sem marca é só informativo', () => {
    const found = ids('https://café.com.br');
    expect(found).toContain('DOM-IDN');
    expect(found).not.toContain('DOM-HOMOGRAFO');
  });

  it('acento imitando marca é homógrafo', () => {
    expect(ids('https://itaú-app.com')).toContain('DOM-HOMOGRAFO');
  });
});

describe('heurísticas de URL', () => {
  it('DOM-TLD-ALTO-RISCO', () => {
    expect(ids('https://exemplo.xyz')).toContain('DOM-TLD-ALTO-RISCO');
    expect(ids('https://exemplo.com.br')).not.toContain('DOM-TLD-ALTO-RISCO');
  });

  it('URL-CREDENCIAIS', () => {
    expect(ids('https://www.itau.com.br@golpe.xyz')).toContain('URL-CREDENCIAIS');
    expect(ids('https://exemplo.com')).not.toContain('URL-CREDENCIAIS');
  });

  it('URL-IP-LITERAL', () => {
    expect(ids('http://45.33.12.9/pix')).toContain('URL-IP-LITERAL');
  });

  it('IP não gera sinais de marca nem de domínio', () => {
    expect(ids('http://45.33.12.9/x')).not.toContain('DOM-TLD-ALTO-RISCO');
  });

  it('URL-ENCURTADOR', () => {
    expect(ids('https://bit.ly/abc')).toContain('URL-ENCURTADOR');
    expect(ids('https://t.ly/abc')).toContain('URL-ENCURTADOR');
    expect(ids('https://exemplo.com/abc')).not.toContain('URL-ENCURTADOR');
  });

  it('URL-SEM-HTTPS só vale para http explícito', () => {
    expect(ids('http://exemplo.com')).toContain('URL-SEM-HTTPS');
    expect(ids('exemplo.com')).not.toContain('URL-SEM-HTTPS');
    expect(ids('https://exemplo.com')).not.toContain('URL-SEM-HTTPS');
  });

  it('URL-PORTA-INCOMUM', () => {
    expect(ids('https://exemplo.com:8443')).toContain('URL-PORTA-INCOMUM');
    expect(ids('https://exemplo.com:443')).not.toContain('URL-PORTA-INCOMUM');
  });

  it('URL-PALAVRA-ISCA conta uma vez só', () => {
    const found = ids('https://exemplo.com/login/atualiza/pix/boleto');
    expect(found.filter((id) => id === 'URL-PALAVRA-ISCA')).toHaveLength(1);
    expect(ids('https://exemplo.com/pixar-filmes')).not.toContain('URL-PALAVRA-ISCA');
  });

  it('DOM-ESTRUTURA-SUSPEITA', () => {
    expect(ids('https://a.b.c.d.exemplo.com')).toContain('DOM-ESTRUTURA-SUSPEITA');
    expect(ids('https://meu-site-muito-legal.com')).toContain('DOM-ESTRUTURA-SUSPEITA');
    expect(ids(`https://${'a'.repeat(55)}.com`)).toContain('DOM-ESTRUTURA-SUSPEITA');
    expect(ids('https://www.exemplo.com')).not.toContain('DOM-ESTRUTURA-SUSPEITA');
  });
});

describe('domínios oficiais', () => {
  it.each([
    ['https://www.itau.com.br', 'Itaú'],
    ['https://internetbanking.itau.com.br/login', 'Itaú'],
    ['https://www.nubank.com.br', 'Nubank'],
    ['https://www.gov.br/receitafederal', 'Governo (gov.br / Receita Federal)'],
    ['https://www.correios.com.br/rastreamento', 'Correios'],
  ])('%s suprime sinais de marca e informa a marca', (url, brand) => {
    const result = analyze(url);
    expect(result.officialBrand).toBe(brand);
    expect(result.signals.some((s) => ['DOM-TYPOSQUAT', 'DOM-MARCA-EMBUTIDA', 'DOM-GOV-FALSO'].includes(s.id))).toBe(false);
  });

  it('qualquer *.gov.br é oficial', () => {
    const result = analyze('https://servicos.receita.fazenda.gov.br');
    expect(result.officialBrand).not.toBeNull();
    expect(result.signals.some((s) => s.id === 'DOM-GOV-FALSO')).toBe(false);
    expect(analyze('https://www.caixa.gov.br/voce').officialBrand).not.toBeNull();
  });

  it('domínio não oficial não informa marca', () => {
    expect(analyze('https://exemplo.com').officialBrand).toBeNull();
    expect(analyze('https://www.itau.com.br.golpe.xyz').officialBrand).toBeNull();
  });
});

describe('falsos positivos', () => {
  it.each([
    'https://interativo.com.br',
    'https://www.bbc.com',
    'https://bbb.exemplo.org.br',
    'https://www.wikipedia.org',
    'https://pt.wikipedia.org/wiki/Pix',
    'https://www.google.com',
    'https://www.globo.com',
    'https://www.uol.com.br',
    'https://www.internet.com.br',
    'https://www.caixas.com.br',
    'https://www.c61.exemplo.com',
  ])('%s não gera sinais de marca', (url) => {
    const found = ids(url);
    for (const id of ['DOM-TYPOSQUAT', 'DOM-MARCA-EMBUTIDA', 'DOM-GOV-FALSO', 'DOM-HOMOGRAFO']) {
      expect(found).not.toContain(id);
    }
  });

  it('marcas curtas só valem em correspondência exata', () => {
    expect(ids('https://bb-app.com')).toContain('DOM-MARCA-EMBUTIDA');
    expect(ids('https://bbc-app.com')).not.toContain('DOM-MARCA-EMBUTIDA');
    expect(ids('https://inter-app.com')).toContain('DOM-MARCA-EMBUTIDA');
    expect(ids('https://interativo-app.com')).not.toContain('DOM-MARCA-EMBUTIDA');
  });
});

describe('segurança das saídas', () => {
  it('os sinais nunca contêm o host analisado', () => {
    const dump = JSON.stringify(analyze('https://segredo-do-usuario-itau.xyz/token').signals);
    expect(dump).not.toContain('segredo-do-usuario');
  });

  it('nenhum texto afirma que algo é seguro', () => {
    const all = analyze('http://itau-seguranca.xyz:8080/login').signals;
    expect(JSON.stringify(all).toLowerCase()).not.toMatch(/\bseguro\b|\bsegura\b/);
  });
});
