import { describe, expect, it } from 'vitest';

import { assertPublicDestination, extractUrls, normalizeUrl, type LookupFn } from '../../../src/utils/url.js';

function expectOk(input: unknown) {
  const result = normalizeUrl(input);
  if (!result.ok) throw new Error(`esperava sucesso, recebeu ${result.reason}`);
  return result.value;
}

describe('normalizeUrl — sucesso', () => {
  it('normaliza caixa do host, remove porta padrão e fragmento', () => {
    const value = expectOk('HTTPS://WWW.Exemplo.COM.br:443/Login?a=1&b=2#secao');

    expect(value).toEqual({
      href: 'https://www.exemplo.com.br/Login?a=1&b=2',
      protocol: 'https:',
      hostname: 'www.exemplo.com.br',
      hostnameUnicode: 'www.exemplo.com.br',
      port: null,
      pathname: '/Login',
      search: '?a=1&b=2',
      schemeInferred: false,
      hadCredentials: false,
      isIpLiteral: false,
    });
  });

  it('mantém porta não padrão', () => {
    expect(expectOk('http://exemplo.com:8080/x').port).toBe(8080);
  });

  it('infere esquema em links colados sem http', () => {
    const value = expectOk('banco-seguro.xyz/atualizar');
    expect(value.href).toBe('http://banco-seguro.xyz/atualizar');
    expect(value.schemeInferred).toBe(true);
  });

  it('infere esquema quando há porta mas não há esquema', () => {
    const value = expectOk('golpe.top:8443/pix');
    expect(value.hostname).toBe('golpe.top');
    expect(value.port).toBe(8443);
    expect(value.schemeInferred).toBe(true);
  });

  it('aceita URL protocol-relative', () => {
    expect(expectOk('//golpe.xyz/a').href).toBe('http://golpe.xyz/a');
  });

  it('converte IDN para punycode e preserva a forma Unicode (homógrafos)', () => {
    const value = expectOk('https://bаnco.com.br/'); // "а" cirílico
    expect(value.hostname).toBe('xn--bnco-53d.com.br');
    expect(value.hostnameUnicode).toBe('bаnco.com.br');
  });

  it('remove ponto final do hostname', () => {
    expect(expectOk('https://exemplo.com./a').hostname).toBe('exemplo.com');
  });

  it('aceita IP público literal', () => {
    const value = expectOk('http://8.8.8.8/');
    expect(value.isIpLiteral).toBe(true);
    expect(expectOk('http://[2606:4700::1111]/').hostname).toBe('[2606:4700::1111]');
  });

  it('remove credenciais embutidas e sinaliza (técnica de phishing)', () => {
    const value = expectOk('https://www.itau.com.br@golpe.xyz/login');
    expect(value.hostname).toBe('golpe.xyz');
    expect(value.hadCredentials).toBe(true);
    expect(value.href).toBe('https://golpe.xyz/login');

    const withPassword = expectOk('https://usuario:senha123@exemplo.com/');
    expect(withPassword.href).not.toContain('senha123');
    expect(withPassword.hadCredentials).toBe(true);
  });

  it('remove caracteres invisíveis e quebras de linha injetadas', () => {
    expect(expectOk('https://exem​plo.com/a\r\nSet-Cookie: x').href).toBe(
      'https://exemplo.com/aSet-Cookie:%20x',
    );
    expect(expectOk('‮https://exemplo.com\u0000/').href).toBe('https://exemplo.com/');
  });
});

describe('normalizeUrl — SSRF', () => {
  it.each([
    'http://127.0.0.1',
    'http://127.0.0.1:8080/admin',
    'http://2130706433', // decimal
    'http://0x7f.1', // hex abreviado
    'http://0177.0.0.1', // octal
    'http://127.1', // abreviado
    'http://0.0.0.0',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'http://[::ffff:7f00:1]',
    'http://[fe80::1]',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1',
    'http://172.16.5.4',
    'http://192.168.0.1/roteador',
    'http://100.64.0.1',
    '192.168.1.1', // sem esquema
  ])('bloqueia IP privado/local %s', (input) => {
    expect(normalizeUrl(input)).toEqual({ ok: false, reason: 'PRIVATE_ADDRESS' });
  });

  it.each([
    'http://localhost',
    'http://LOCALHOST.',
    'http://localhost:3000/health',
    'localhost:3000',
    'http://ⓛⓞⓒⓐⓛⓗⓞⓢⓣ', // caracteres circulados → "localhost"
    'http://app.localhost',
    'http://impressora.local',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://nas.home.arpa',
    'http://servidor.lan',
    'http://intranet',
    'http://router/',
  ])('bloqueia hostname local %s', (input) => {
    expect(normalizeUrl(input)).toEqual({ ok: false, reason: 'LOCAL_HOSTNAME' });
  });
});

describe('normalizeUrl — esquemas', () => {
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://exemplo.com/arquivo',
    'blob:https://exemplo.com/uuid',
    'vbscript:msgbox(1)',
    'mailto:golpe@exemplo.com',
  ])('rejeita esquema não permitido %j', (input) => {
    expect(normalizeUrl(input)).toEqual({ ok: false, reason: 'UNSUPPORTED_SCHEME' });
  });
});

describe('normalizeUrl — borda', () => {
  it.each(['', '   ', '​​', '\n\t'])('rejeita vazio %j', (input) => {
    expect(normalizeUrl(input)).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it.each([undefined, null, 42, {}])('rejeita entrada não string %j', (input) => {
    expect(normalizeUrl(input)).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('rejeita URL acima do limite', () => {
    const url = `https://exemplo.com/${'a'.repeat(2049)}`;
    expect(normalizeUrl(url)).toEqual({ ok: false, reason: 'TOO_LONG' });
    expect(normalizeUrl('a'.repeat(10_000_000))).toEqual({ ok: false, reason: 'TOO_LONG' });
  });

  it('aceita exatamente no limite', () => {
    const url = `https://exemplo.com/${'a'.repeat(2048 - 'https://exemplo.com/'.length)}`;
    expect(normalizeUrl(url).ok).toBe(true);
  });

  it.each(['http://', 'https://', 'http://exa mple.com', 'http://999.1.1.1', 'http://[::1', '://exemplo.com', 'http://.'])(
    'rejeita URL malformada %j',
    (input) => {
      expect(normalizeUrl(input)).toMatchObject({ ok: false });
    },
  );

  it('não ecoa a entrada no resultado de erro', () => {
    const result = normalizeUrl('javascript:roubar("dados-secretos")');
    expect(JSON.stringify(result)).not.toContain('dados-secretos');
  });
});

describe('assertPublicDestination', () => {
  const fakeLookup =
    (...addresses: string[]): LookupFn =>
    async () =>
      addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));

  it('aceita hostname que resolve só para IPs públicos', async () => {
    await expect(assertPublicDestination('exemplo.com', { lookup: fakeLookup('93.184.215.14', '2606:2800::1') })).resolves.toEqual({
      ok: true,
      value: ['93.184.215.14', '2606:2800::1'],
    });
  });

  it('rejeita se qualquer IP resolvido for privado (DNS apontando para rede interna)', async () => {
    await expect(assertPublicDestination('golpe.xyz', { lookup: fakeLookup('8.8.8.8', '10.0.0.5') })).resolves.toEqual({
      ok: false,
      reason: 'RESOLVES_TO_PRIVATE',
    });
    await expect(assertPublicDestination('golpe.xyz', { lookup: fakeLookup('::ffff:127.0.0.1') })).resolves.toEqual({
      ok: false,
      reason: 'RESOLVES_TO_PRIVATE',
    });
  });

  it('verifica IP literal sem consultar DNS', async () => {
    const lookup: LookupFn = async () => {
      throw new Error('não deveria consultar DNS');
    };
    await expect(assertPublicDestination('[::1]', { lookup })).resolves.toEqual({ ok: false, reason: 'PRIVATE_ADDRESS' });
    await expect(assertPublicDestination('8.8.8.8', { lookup })).resolves.toEqual({ ok: true, value: ['8.8.8.8'] });
  });

  it('falha fechado quando o DNS dá erro', async () => {
    const lookup: LookupFn = async () => {
      throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    };
    await expect(assertPublicDestination('nao-existe.xyz', { lookup })).resolves.toEqual({ ok: false, reason: 'DNS_FAILURE' });
  });

  it('falha fechado quando a resolução vem vazia', async () => {
    await expect(assertPublicDestination('vazio.xyz', { lookup: fakeLookup() })).resolves.toEqual({
      ok: false,
      reason: 'DNS_FAILURE',
    });
  });

  it('falha fechado no timeout', async () => {
    const lookup: LookupFn = () => new Promise(() => {});
    await expect(assertPublicDestination('lento.xyz', { lookup, timeoutMs: 20 })).resolves.toEqual({
      ok: false,
      reason: 'DNS_FAILURE',
    });
  });
});

describe('extractUrls', () => {
  it('extrai links com esquema e domínios soltos', () => {
    expect(extractUrls('Acesse https://golpe.xyz/pix agora ou bit.ly/abc123 e golpe2.top')).toEqual([
      'https://golpe.xyz/pix',
      'bit.ly/abc123',
      'golpe2.top',
    ]);
  });

  it('remove pontuação final', () => {
    expect(extractUrls('Veja https://exemplo.com/a, depois exemplo.org.br.')).toEqual([
      'https://exemplo.com/a',
      'exemplo.org.br',
    ]);
  });

  it('deduplica sem diferenciar maiúsculas', () => {
    expect(extractUrls('exemplo.com EXEMPLO.COM exemplo.com')).toEqual(['exemplo.com']);
  });

  it('respeita o limite (padrão 10)', () => {
    const text = Array.from({ length: 15 }, (_, i) => `site${i}.com`).join(' ');
    expect(extractUrls(text)).toHaveLength(10);
    expect(extractUrls(text, 3)).toHaveLength(3);
    expect(extractUrls(text, 0)).toEqual([]);
  });

  it('ignora e-mails, arquivos e números decimais', () => {
    expect(extractUrls('fale com joao@exemplo.com, veja foto.png e o valor 3.14 ou R$ 1.200,00')).toEqual([]);
  });

  it('texto sem links, vazio ou não string retorna lista vazia', () => {
    expect(extractUrls('Oi, tudo bem? Chego às 18h.')).toEqual([]);
    expect(extractUrls('')).toEqual([]);
    expect(extractUrls(undefined as unknown as string)).toEqual([]);
  });

  it('não duplica o domínio de uma URL com esquema como domínio solto', () => {
    expect(extractUrls('https://www.itau.com.br/conta')).toEqual(['https://www.itau.com.br/conta']);
  });

  it('é rápido com entradas longas e repetitivas', () => {
    const started = Date.now();
    extractUrls('a.'.repeat(5000) + 'b-'.repeat(5000));
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
