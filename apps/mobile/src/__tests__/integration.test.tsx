import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { AnalyzeResponse } from '../types/api';
import Index from '../app/index';

jest.mock('expo-network', () => ({ useNetworkState: jest.fn(() => ({ isConnected: true })) }));

const SECRET = 'texto privado do usuario 123 segredo';

const okBody: AnalyzeResponse = {
  type: 'message',
  targetRef: 'a1'.repeat(32),
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

let fetchSpy: jest.SpyInstance;

async function typeAndSubmit(text = SECRET) {
  await fireEvent.changeText(screen.getByTestId('content-input'), text);
  await fireEvent.press(screen.getByTestId('submit-button'));
}

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

describe('integração: tela + api.ts real + fetch simulado', () => {
  it('fetch rejeita com TypeError -> mensagem de NETWORK_ERROR', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByText('Não foi possível conectar ao servidor. Verifique sua conexão.')).toBeTruthy();
    expect(screen.queryByText(new RegExp(SECRET))).toBeNull();
  });

  it('fetch que nunca resolve -> mensagem de TIMEOUT após 10 s', async () => {
    jest.useFakeTimers();
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    );
    await render(<Index />);
    await typeAndSubmit();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(await screen.findByText('A verificação demorou demais. Tente novamente.')).toBeTruthy();
    expect(screen.queryByText(new RegExp(SECRET))).toBeNull();
  });

  it('429 com Retry-After: 5 -> mensagem com "5 s" e botão bloqueado', async () => {
    const body = {
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas requisições enviadas. Tente novamente mais tarde.' },
    };
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
      }),
    );
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByText(/Aguarde 5 s/)).toBeTruthy();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    expect(screen.getByTestId('retry-countdown')).toHaveTextContent('Tente novamente em 5 s');
    expect(screen.queryByText(new RegExp(SECRET))).toBeNull();
  });

  it('200 com relatório -> RiskCard e corpo enviado só com {type, content}', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(okBody), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await render(<Index />);
    await typeAndSubmit();
    expect(await screen.findByText(okBody.report.label)).toBeTruthy();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ type: 'message', content: SECRET });
  });

  it('feedback: envia só ref, nível e IDs, nunca o texto digitado', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(okBody), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'received' }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
      );
    await render(<Index />);
    await typeAndSubmit();
    await screen.findByText(okBody.report.label);
    await fireEvent.press(screen.getByTestId('feedback-scam'));
    expect(await screen.findByTestId('feedback-thanks')).toBeTruthy();

    const [url, init] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/feedback$/);
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'SCAM_REPORT',
      target: { type: 'message', ref: okBody.targetRef },
      level: 'NO_KNOWN_INDICATORS',
      signalIds: [],
    });
    expect(init.body as string).not.toContain(SECRET);
  });
});
