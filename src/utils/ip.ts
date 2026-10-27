import { BlockList, isIP } from 'node:net';

/**
 * Classificação de endereços IP para proteção contra SSRF.
 * Qualquer endereço que não seja roteável publicamente é considerado bloqueado.
 */

const BLOCKED_IPV4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], // "esta rede"
  ['10.0.0.0', 8], // privada (RFC 1918)
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local / metadata de nuvem
  ['172.16.0.0', 12], // privada (RFC 1918)
  ['192.0.0.0', 24], // IETF
  ['192.0.2.0', 24], // documentação
  ['192.168.0.0', 16], // privada (RFC 1918)
  ['198.18.0.0', 15], // benchmark
  ['198.51.100.0', 24], // documentação
  ['203.0.113.0', 24], // documentação
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reservada + broadcast
];

const BLOCKED_IPV6: ReadonlyArray<readonly [string, number]> = [
  ['::', 128], // não especificado
  ['::1', 128], // loopback
  ['100::', 64], // descarte
  ['2001::', 32], // Teredo (IPv4 do cliente é ofuscado; bloqueado por precaução)
  ['2001:db8::', 32], // documentação
  ['fc00::', 7], // ULA (privada)
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
];

const blockList = new BlockList();
for (const [network, prefix] of BLOCKED_IPV4) blockList.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of BLOCKED_IPV6) blockList.addSubnet(network, prefix, 'ipv6');

/** Expande um IPv6 (inclusive com IPv4 no final) para 8 grupos de 16 bits. */
function expandIpv6(address: string): number[] | null {
  let addr = address;

  // "::ffff:127.0.0.1" → "::ffff:7f00:1"
  const lastColon = addr.lastIndexOf(':');
  const maybeV4 = addr.slice(lastColon + 1);
  if (maybeV4.includes('.')) {
    if (isIP(maybeV4) !== 4) return null;
    const [a, b, c, d] = maybeV4.split('.').map(Number) as [number, number, number, number];
    addr = `${addr.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const parse = (part: string): number[] => (part === '' ? [] : part.split(':').map((h) => parseInt(h, 16)));
  const [head = '', rest, extra] = addr.split('::');
  if (extra !== undefined) return null;
  const left = parse(head);
  const right = rest === undefined ? [] : parse(rest);
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (rest === undefined && missing !== 0)) return null;

  const groups = [...left, ...Array<number>(missing).fill(0), ...right];
  return groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function toIpv4(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

/** IPv4 embutido em IPv6 mapeado/compatível (::ffff:a.b.c.d, ::a.b.c.d), NAT64 (64:ff9b::/96) ou 6to4 (2002::/16). */
function embeddedIpv4(address: string): string | null {
  const g = expandIpv6(address);
  if (!g) return null;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [number, number, number, number, number, number, number, number];

  const firstFiveZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if (firstFiveZero && (g5 === 0xffff || g5 === 0)) return toIpv4(g6, g7);
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return toIpv4(g6, g7);
  if (g0 === 0x2002) return toIpv4(g1, g2);
  return null;
}

/**
 * `true` somente para IPs roteáveis publicamente.
 * Aceita colchetes (`[::1]`) e zone id (`fe80::1%eth0`). Entrada inválida → `false` (fail closed).
 */
export function isPublicIp(address: string): boolean {
  const addr = address.trim().replace(/^\[(.*)\]$/, '$1').replace(/%.*$/, '');
  try {
    const version = isIP(addr);
    if (version === 4) return !blockList.check(addr, 'ipv4');
    if (version === 6) {
      if (blockList.check(addr, 'ipv6')) return false;
      const embedded = embeddedIpv4(addr);
      return embedded === null ? true : isPublicIp(embedded);
    }
  } catch {
    // Qualquer falha de parsing é tratada como não pública.
  }
  return false;
}
