import { render, screen } from '@testing-library/react-native';

import { RiskCard } from '../components/RiskCard';
import type { AnalysisReport, RiskLevel } from '../types/api';

function makeReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    level: 'NO_KNOWN_INDICATORS',
    label: 'Nenhum Indicador Conhecido Encontrado',
    score: 0,
    signals: [],
    advice: [],
    disclaimer: 'Esta análise não garante segurança.',
    externalCheck: 'disabled',
    ...overrides,
  };
}

const LEVELS: [RiskLevel, string, number, string][] = [
  ['NO_KNOWN_INDICATORS', 'Nenhum Indicador Conhecido Encontrado', 0, 'text-risk-none'],
  ['NEEDS_ATTENTION', 'Requer Atenção', 45, 'text-risk-attention'],
  ['HIGH_RISK', 'Alto Risco', 90, 'text-risk-high'],
];

describe('RiskCard', () => {
  describe.each(LEVELS)('nível %s', (level, label, score, colorClass) => {
    it('renderiza label, score e disclaimer', async () => {
      await render(<RiskCard report={makeReport({ level, label, score })} />);
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByTestId('risk-score')).toHaveTextContent(`${score}/100`);
      expect(screen.getByText('Esta análise não garante segurança.')).toBeTruthy();
    });

    it('aplica a classe de cor do nível no label', async () => {
      await render(<RiskCard report={makeReport({ level, label, score })} />);
      expect(screen.getByTestId('result-label')).toHaveProp('className', expect.stringContaining(colorClass));
    });
  });

  it('exibe signal crítico com título, explicação, conselho e severidade', async () => {
    const report = makeReport({
      level: 'HIGH_RISK',
      label: 'Alto Risco',
      score: 95,
      signals: [
        {
          id: 'pix-urgente',
          category: 'social',
          severity: 'critical',
          weight: 50,
          title: 'Pedido urgente de Pix',
          explanation: 'Golpistas criam urgência para você pagar.',
          advice: 'Não faça o pagamento.',
        },
      ],
    });
    await render(<RiskCard report={report} />);
    expect(screen.getByText('Sinais encontrados')).toBeTruthy();
    expect(screen.getByTestId('signal-pix-urgente')).toBeTruthy();
    expect(screen.getByText('Pedido urgente de Pix')).toBeTruthy();
    expect(screen.getByText('Golpistas criam urgência para você pagar.')).toBeTruthy();
    expect(screen.getByText('Não faça o pagamento.')).toBeTruthy();
    expect(screen.getByText(/Crítica/)).toBeTruthy();
  });

  it('omite a seção de sinais quando não há signals', async () => {
    await render(<RiskCard report={makeReport({ signals: [] })} />);
    expect(screen.queryByText('Sinais encontrados')).toBeNull();
  });

  it('renderiza a lista de orientações', async () => {
    await render(<RiskCard report={makeReport({ advice: ['Não clique no link.', 'Confirme com o banco.'] })} />);
    expect(screen.getByText('O que fazer')).toBeTruthy();
    expect(screen.getByText(/Não clique no link\./)).toBeTruthy();
    expect(screen.getByText(/Confirme com o banco\./)).toBeTruthy();
  });

  it('mostra a nota somente quando externalCheck é unavailable', async () => {
    const note = 'Fonte externa indisponível; análise feita com regras locais.';
    const { rerender } = await render(<RiskCard report={makeReport({ externalCheck: 'unavailable' })} />);
    expect(screen.getByText(note)).toBeTruthy();
    await rerender(<RiskCard report={makeReport({ externalCheck: 'checked' })} />);
    expect(screen.queryByText(note)).toBeNull();
  });

  it('exibe o horário da análise quando analyzedAt é válido', async () => {
    const analyzedAt = new Date(2026, 9, 28, 14, 5).toISOString();
    await render(<RiskCard report={makeReport()} analyzedAt={analyzedAt} />);
    expect(screen.getByTestId('analyzed-at')).toHaveTextContent('Analisado às 14:05');
  });

  it('omite o horário sem analyzedAt', async () => {
    await render(<RiskCard report={makeReport()} />);
    expect(screen.queryByTestId('analyzed-at')).toBeNull();
  });

  it('omite o horário quando analyzedAt é inválido', async () => {
    await render(<RiskCard report={makeReport()} analyzedAt="não-é-data" />);
    expect(screen.queryByTestId('analyzed-at')).toBeNull();
  });
});
