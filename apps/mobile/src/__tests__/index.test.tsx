import { fireEvent, render, screen } from '@testing-library/react-native';

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
});
