import type { RiskLevel } from '../../src/core/types.js';

export interface ScamUrlFixture {
  url: string;
  expectedLevel: Exclude<RiskLevel, 'NO_KNOWN_INDICATORS'>;
  expectedSignals: string[];
}

/** O homógrafo usa "а" cirílica (U+0430) no lugar do "a" de itau. */
export const CYRILLIC_ITAU = 'https://itаu.com.br';

export const SCAM_URLS: ScamUrlFixture[] = [
  { url: 'bradesc0.com.br', expectedLevel: 'HIGH_RISK', expectedSignals: ['DOM-TYPOSQUAT'] },
  { url: 'nubamk.com', expectedLevel: 'HIGH_RISK', expectedSignals: ['DOM-TYPOSQUAT'] },
  { url: 'https://itau-seguranca.com', expectedLevel: 'NEEDS_ATTENTION', expectedSignals: ['DOM-MARCA-EMBUTIDA'] },
  { url: 'https://nubank-app.xyz', expectedLevel: 'HIGH_RISK', expectedSignals: ['DOM-MARCA-EMBUTIDA', 'DOM-TLD-ALTO-RISCO'] },
  { url: 'https://caixa.gov.br.atendimento.top', expectedLevel: 'HIGH_RISK', expectedSignals: ['DOM-GOV-FALSO'] },
  { url: 'https://receita-gov-br.com', expectedLevel: 'HIGH_RISK', expectedSignals: ['DOM-GOV-FALSO'] },
  { url: CYRILLIC_ITAU, expectedLevel: 'HIGH_RISK', expectedSignals: ['DOM-HOMOGRAFO'] },
  { url: 'https://www.itau.com.br@golpe.xyz', expectedLevel: 'HIGH_RISK', expectedSignals: ['URL-CREDENCIAIS'] },
  { url: 'http://45.33.12.9/pix', expectedLevel: 'NEEDS_ATTENTION', expectedSignals: ['URL-IP-LITERAL', 'URL-SEM-HTTPS'] },
  { url: 'bit.ly/abc123', expectedLevel: 'NEEDS_ATTENTION', expectedSignals: ['URL-ENCURTADOR'] },
  { url: 'correios-rastreio.online/taxa', expectedLevel: 'HIGH_RISK', expectedSignals: ['DOM-MARCA-EMBUTIDA'] },
];

export const LEGIT_URLS: string[] = [
  'https://www.itau.com.br',
  'https://www.gov.br/receitafederal',
  'https://www.correios.com.br/rastreamento',
  'https://pt.wikipedia.org/wiki/Pix',
  'https://www.google.com',
  'https://www.globo.com',
  'https://www.uol.com.br',
  'https://www.bbc.com',
  'https://www.interativo.com.br',
];
