import { render, screen } from '@testing-library/react-native';

import { MetricsDashboard } from '../components/MetricsDashboard';
import type { MetricsResponse } from '../types/api';

const zeroCategories = {
  easy_money: 0,
  fake_billing: 0,
  urgency: 0,
  credential_request: 0,
  impersonation: 0,
  payment_pressure: 0,
  fake_prize: 0,
  fake_job: 0,
  domain: 0,
  url_structure: 0,
  threat_intel: 0,
};

const metrics = (over: Partial<MetricsResponse> = {}): MetricsResponse => ({
  since: '2026-10-29',
  generatedAt: '2026-10-29T12:00:00.000Z',
  analyses: { total: 10, byType: { message: 6, url: 4 } },
  levels: { HIGH_RISK: 5, NEEDS_ATTENTION: 3, NO_KNOWN_INDICATORS: 2 },
  categories: { ...zeroCategories, urgency: 3, easy_money: 7 },
  feedback: { scamReports: 4, falsePositives: 1 },
  ...over,
});

describe('MetricsDashboard', () => {
  it('mostra os KPIs', async () => {
    await render(<MetricsDashboard metrics={metrics()} />);
    expect(screen.getByTestId('metrics-total')).toHaveTextContent('10');
    expect(screen.getByTestId('metrics-messages')).toHaveTextContent('6');
    expect(screen.getByTestId('metrics-urls')).toHaveTextContent('4');
    expect(screen.getByTestId('metrics-scam-reports')).toHaveTextContent('4');
    expect(screen.getByTestId('metrics-false-positives')).toHaveTextContent('1');
  });

  it('barras de nível com largura proporcional ao total e rótulos em PT-BR', async () => {
    await render(<MetricsDashboard metrics={metrics()} />);
    expect(screen.getByTestId('metrics-level-HIGH_RISK-bar').props.style).toEqual(
      expect.objectContaining({ width: '50%' }),
    );
    expect(screen.getByTestId('metrics-level-NEEDS_ATTENTION-bar').props.style).toEqual(
      expect.objectContaining({ width: '30%' }),
    );
    expect(screen.getByTestId('metrics-level-HIGH_RISK')).toHaveTextContent(/Alto Risco/);
    expect(screen.getByTestId('metrics-level-HIGH_RISK')).toHaveTextContent(/5/);
    expect(screen.getByTestId('metrics-level-NO_KNOWN_INDICATORS')).toHaveTextContent(/Nenhum Indicador Conhecido Encontrado/);
  });

  it('categorias: só as com contagem > 0, em ordem decrescente', async () => {
    await render(<MetricsDashboard metrics={metrics()} />);
    expect(screen.getByTestId('metrics-category-easy_money')).toBeTruthy();
    expect(screen.getByTestId('metrics-category-urgency')).toBeTruthy();
    expect(screen.queryByTestId('metrics-category-domain')).toBeNull();
    const ids = screen.getAllByTestId(/^metrics-category-[a-z_]+$/).map((n) => n.props.testID);
    expect(ids).toEqual(['metrics-category-easy_money', 'metrics-category-urgency']);
  });

  it('estado vazio quando não há análises', async () => {
    await render(
      <MetricsDashboard
        metrics={metrics({
          analyses: { total: 0, byType: { message: 0, url: 0 } },
          levels: { HIGH_RISK: 0, NEEDS_ATTENTION: 0, NO_KNOWN_INDICATORS: 0 },
          categories: zeroCategories,
        })}
      />,
    );
    expect(screen.getByTestId('metrics-empty')).toHaveTextContent('Ainda não há análises registradas');
    expect(screen.queryByTestId('metrics-level-HIGH_RISK')).toBeNull();
  });

  it('rodapé anônimo, sem afirmar segurança total', async () => {
    await render(<MetricsDashboard metrics={metrics()} />);
    expect(screen.getByText(/Dados agregados e anônimos desde 2026-10-29; zeram quando o servidor reinicia/)).toBeTruthy();
    expect(screen.queryByText(/100% seguro/)).toBeNull();
  });
});
