import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { analyzeTarget } from '../services/api';
import type { AnalyzeResponse } from '../types/api';
import Index from '../app/index';

jest.mock('../services/api', () => ({
  ...jest.requireActual('../services/api'),
  analyzeTarget: jest.fn(),
}));

const { AppError } = jest.requireActual('../services/api') as typeof import('../services/api');
const mockAnalyze = analyzeTarget as jest.Mock;

const SECRET = 'minha-chave-pix-123@segredo.com';

const okResponse: AnalyzeResponse = {
  type: 'url',
  report: {
    level: 'NO_KNOWN_INDICATORS',
    label: 'Nenhum Indicador Conhecido Encontrado',
    score: 0,
    signals: [],
    advice: [],
    disclaimer: 'Esta análise não garante segurança.',
    externalCheck: 'disabled',
  },
};

async function typeAndSubmit(text = SECRET) {
  await fireEvent.changeText(screen.getByTestId('content-input'), text);
  await fireEvent.press(screen.getByTestId('submit-button'));
}

beforeEach(() => mockAnalyze.mockReset());

describe('tela de análise', () => {
  it('botão desabilitado com input vazio', async () => {
    await render(<Index />);
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('content-input'), 'exemplo.com');
    expect(screen.getByTestId('submit-button')).toBeEnabled();
  });

  it('mostra loading e desabilita o botão enquanto pendente', async () => {
    mockAnalyze.mockReturnValue(new Promise(() => {}));
    await render(<Index />);
    await typeAndSubmit();
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
  });

  it('sucesso exibe o label do relatório', async () => {
    mockAnalyze.mockResolvedValue(okResponse);
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByText(okResponse.report.label)).toBeTruthy();
    expect(screen.getByTestId('analyzed-at')).toBeTruthy();
    expect(mockAnalyze).toHaveBeenCalledWith(SECRET);
  });

  it('TIMEOUT exibe a mensagem', async () => {
    mockAnalyze.mockRejectedValue(new AppError('TIMEOUT', 'A verificação demorou demais. Tente novamente.'));
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByText('A verificação demorou demais. Tente novamente.')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('RATE_LIMIT_EXCEEDED exibe a mensagem com o tempo de espera', async () => {
    const msg = 'Muitas verificações em pouco tempo. Aguarde 30 s e tente novamente.';
    mockAnalyze.mockRejectedValue(new AppError('RATE_LIMIT_EXCEEDED', msg, 429, undefined, 30));
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByText(msg)).toBeTruthy();
  });

  it('erro genérico mostra mensagem fixa sem ecoar o texto digitado', async () => {
    mockAnalyze.mockRejectedValue(new Error(`falha com ${SECRET}`));
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByText('Não foi possível concluir a verificação. Tente novamente.')).toBeTruthy();
    expect(screen.queryByText(new RegExp(SECRET))).toBeNull();
  });

  it('NETWORK_ERROR exibe a mensagem', async () => {
    const msg = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    mockAnalyze.mockRejectedValue(new AppError('NETWORK_ERROR', msg));
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByText(msg)).toBeTruthy();
    expect(screen.getByTestId('submit-button')).toBeEnabled();
  });

  it('nova submissão limpa o erro anterior (error -> loading -> success)', async () => {
    mockAnalyze.mockRejectedValueOnce(new AppError('TIMEOUT', 'A verificação demorou demais. Tente novamente.'));
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByRole('alert')).toBeTruthy();

    mockAnalyze.mockReturnValueOnce(new Promise(() => {}));
    await fireEvent.press(screen.getByTestId('submit-button'));
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('429 sem retryAfterSeconds não bloqueia o botão', async () => {
    mockAnalyze.mockRejectedValue(new AppError('RATE_LIMIT_EXCEEDED', 'Aguarde um pouco e tente novamente.', 429));
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByText('Aguarde um pouco e tente novamente.')).toBeTruthy();
    expect(screen.queryByTestId('retry-countdown')).toBeNull();
    expect(screen.getByTestId('submit-button')).toBeEnabled();
  });

  describe('bloqueio por 429 com Retry-After', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('desabilita o botão com contagem e reabilita ao chegar a 0', async () => {
      const msg = 'Muitas verificações em pouco tempo. Aguarde 3 s e tente novamente.';
      mockAnalyze.mockRejectedValue(new AppError('RATE_LIMIT_EXCEEDED', msg, 429, undefined, 3));
      await render(<Index />);
      await typeAndSubmit();

      expect(await screen.findByText(msg)).toBeTruthy();
      expect(screen.getByTestId('submit-button')).toBeDisabled();
      expect(screen.getByTestId('retry-countdown')).toHaveTextContent('Tente novamente em 3 s');

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('retry-countdown')).toHaveTextContent('Tente novamente em 2 s');

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(screen.queryByTestId('retry-countdown')).toBeNull();
      expect(screen.getByTestId('submit-button')).toBeEnabled();
      expect(screen.getByText('Verificar')).toBeTruthy();
    });
  });
});
