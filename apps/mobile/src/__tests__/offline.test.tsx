import { fireEvent, render, screen } from '@testing-library/react-native';
import { useNetworkState } from 'expo-network';

import { analyzeTarget } from '../services/api';
import Index from '../app/index';

jest.mock('expo-network', () => ({ useNetworkState: jest.fn(() => ({ isConnected: true })) }));
jest.mock('../services/api', () => ({
  ...jest.requireActual('../services/api'),
  analyzeTarget: jest.fn(),
}));

const mockNetwork = useNetworkState as jest.Mock;
const mockAnalyze = analyzeTarget as jest.Mock;

const SECRET = 'minha-chave-pix-123@segredo.com';
const OFFLINE_MESSAGE = 'Você está sem conexão com a internet. Conecte-se para verificar links e mensagens.';

beforeEach(() => {
  mockAnalyze.mockReset();
  mockNetwork.mockReset();
});

describe('modo offline', () => {
  it('offline: mostra o banner e desabilita o botão mesmo com texto digitado', async () => {
    mockNetwork.mockReturnValue({ isConnected: false });
    await render(<Index />);
    await fireEvent.changeText(screen.getByTestId('content-input'), SECRET);
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
  });

  it('offline: pressionar não chama analyzeTarget nem fetch', async () => {
    mockNetwork.mockReturnValue({ isConnected: false });
    const fetchSpy = jest.spyOn(global, 'fetch');
    await render(<Index />);
    await fireEvent.changeText(screen.getByTestId('content-input'), SECRET);
    await fireEvent.press(screen.getByTestId('submit-button'));
    expect(mockAnalyze).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('ao reconectar, o banner some e o botão é habilitado', async () => {
    mockNetwork.mockReturnValue({ isConnected: false });
    const view = await render(<Index />);
    await fireEvent.changeText(screen.getByTestId('content-input'), SECRET);
    expect(screen.getByTestId('submit-button')).toBeDisabled();

    mockNetwork.mockReturnValue({ isConnected: true });
    await view.rerender(<Index />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.getByTestId('submit-button')).not.toBeDisabled();
  });

  it('estado desconhecido (undefined) conta como online', async () => {
    mockNetwork.mockReturnValue({ isConnected: undefined });
    await render(<Index />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.getByTestId('submit-button')).toBeDisabled(); // vazio
    await fireEvent.changeText(screen.getByTestId('content-input'), SECRET);
    expect(screen.getByTestId('submit-button')).not.toBeDisabled();
  });

  it('LGPD: o texto digitado nunca aparece na tela offline', async () => {
    mockNetwork.mockReturnValue({ isConnected: false });
    await render(<Index />);
    await fireEvent.changeText(screen.getByTestId('content-input'), SECRET);
    await fireEvent.press(screen.getByTestId('submit-button'));
    expect(screen.queryByText(new RegExp(SECRET))).toBeNull();
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });
});
