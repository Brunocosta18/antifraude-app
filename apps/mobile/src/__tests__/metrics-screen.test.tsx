import { fireEvent, render, screen } from '@testing-library/react-native';
import { useNetworkState } from 'expo-network';

import { getMetrics } from '../services/api';
import type { MetricsResponse } from '../types/api';
import MetricsScreen from '../app/metrics';

jest.mock('../services/api', () => ({
  ...jest.requireActual('../services/api'),
  getMetrics: jest.fn(),
}));

const { AppError } = jest.requireActual('../services/api') as typeof import('../services/api');
const mockGet = getMetrics as jest.Mock;

jest.mock('expo-network', () => ({ useNetworkState: jest.fn(() => ({ isConnected: true })) }));
const mockNetwork = useNetworkState as jest.Mock;

const okMetrics: MetricsResponse = {
  since: '2026-10-29',
  generatedAt: '2026-10-29T12:00:00.000Z',
  analyses: { total: 3, byType: { message: 2, url: 1 } },
  levels: { HIGH_RISK: 2, NEEDS_ATTENTION: 1, NO_KNOWN_INDICATORS: 0 },
  categories: {
    easy_money: 2,
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
  },
  feedback: { scamReports: 1, falsePositives: 0 },
};

beforeEach(() => {
  mockGet.mockReset();
  mockNetwork.mockReturnValue({ isConnected: true });
});

describe('tela do painel de métricas', () => {
  it('carrega e mostra o painel', async () => {
    mockGet.mockResolvedValue(okMetrics);
    await render(<MetricsScreen />);
    expect(await screen.findByTestId('metrics-total')).toHaveTextContent('3');
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('erro mostra texto fixo e "Tentar novamente" refaz a chamada', async () => {
    mockGet.mockRejectedValueOnce(new AppError('NETWORK_ERROR', 'mensagem-do-servidor')).mockResolvedValueOnce(okMetrics);
    await render(<MetricsScreen />);
    expect(await screen.findByTestId('metrics-error')).toBeTruthy();
    expect(screen.queryByText(/mensagem-do-servidor/)).toBeNull();
    await fireEvent.press(screen.getByTestId('metrics-retry'));
    expect(await screen.findByTestId('metrics-total')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('429 mostra mensagem própria do painel', async () => {
    mockGet.mockRejectedValue(new AppError('RATE_LIMIT_EXCEEDED', 'x', 429, undefined, 10));
    await render(<MetricsScreen />);
    expect(await screen.findByText(/Muitas consultas ao painel/)).toBeTruthy();
  });

  it('"Atualizar" busca de novo', async () => {
    mockGet.mockResolvedValue(okMetrics);
    await render(<MetricsScreen />);
    await screen.findByTestId('metrics-total');
    await fireEvent.press(screen.getByTestId('metrics-refresh'));
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('offline: mostra o aviso e não faz requisição', async () => {
    mockNetwork.mockReturnValue({ isConnected: false });
    await render(<MetricsScreen />);
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
