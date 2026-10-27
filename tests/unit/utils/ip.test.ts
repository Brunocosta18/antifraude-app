import { describe, expect, it } from 'vitest';

import { isPublicIp } from '../../../src/utils/ip.js';

describe('isPublicIp', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1',
    '127.0.0.1',
    '127.255.255.254',
    '169.254.169.254', // metadata de nuvem
    '172.16.0.0',
    '172.31.255.255',
    '192.0.0.8',
    '192.0.2.1',
    '192.168.0.1',
    '198.18.0.1',
    '198.51.100.7',
    '203.0.113.9',
    '224.0.0.1',
    '255.255.255.255',
  ])('bloqueia IPv4 não público %s', (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it.each(['::', '::1', '[::1]', 'fe80::1', 'fe80::1%eth0', 'fc00::1', 'fd12:3456::1', 'ff02::1', '2001:db8::1', '2001:0:4136:e378::1'])(
    'bloqueia IPv6 não público %s',
    (ip) => {
      expect(isPublicIp(ip)).toBe(false);
    },
  );

  it.each([
    '::ffff:127.0.0.1', // IPv4 mapeado (notação mista)
    '::ffff:7f00:1', // IPv4 mapeado (hex)
    '[::ffff:a9fe:a9fe]', // 169.254.169.254 mapeado
    '::10.0.0.1', // IPv4 compatível (obsoleto)
    '64:ff9b::a00:1', // NAT64 → 10.0.0.1
    '64:ff9b::192.168.0.1', // NAT64 notação mista
    '2002:7f00:1::', // 6to4 → 127.0.0.1
    '2002:c0a8:0101::1', // 6to4 → 192.168.1.1
  ])('bloqueia IPv6 que embute IPv4 privado %s', (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.15.255.255', '172.32.0.0', '100.63.255.255', '100.128.0.0', '2606:4700::1111', '2804:14c::1', '::ffff:8.8.8.8', '64:ff9b::808:808'])(
    'aceita IP público %s',
    (ip) => {
      expect(isPublicIp(ip)).toBe(true);
    },
  );

  it.each(['', 'abc', '999.1.1.1', '1.2.3', '127.0.0.1.1', 'localhost', '::ffff:999.0.0.1', '1:2:3:4:5:6:7:8:9'])(
    'rejeita entrada inválida %j (fail closed)',
    (ip) => {
      expect(isPublicIp(ip)).toBe(false);
    },
  );
});
