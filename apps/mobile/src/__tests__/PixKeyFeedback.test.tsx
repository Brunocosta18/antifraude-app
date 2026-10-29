import { render, screen } from '@testing-library/react-native';

import { PixKeyFeedback } from '../components/PixKeyFeedback';
import type { PixKeyCheck } from '../utils/pix';

const CONFIRM_TEXT = 'Confira o nome e o banco do recebedor antes de confirmar o Pix';
const LOCAL_TEXT = 'A chave foi verificada só no seu aparelho';

describe('PixKeyFeedback', () => {
  it.each<[PixKeyCheck, string]>([
    [{ type: 'cpf', status: 'invalid', reasons: ['INVALID_CHECK_DIGITS'] }, 'invalid'],
    [{ type: 'email', status: 'suspicious', reasons: ['BRAND_IMPERSONATION'] }, 'suspicious'],
    [{ type: 'evp', status: 'valid', reasons: [] }, 'valid'],
  ])('mostra o status %j', async (check, status) => {
    await render(<PixKeyFeedback check={check} />);
    expect(screen.getByTestId('pix-feedback')).toBeTruthy();
    expect(screen.getByTestId(`pix-status-${status}`)).toBeTruthy();
  });

  it('mostra sempre os avisos fixos', async () => {
    await render(<PixKeyFeedback check={{ type: 'evp', status: 'valid', reasons: [] }} />);
    expect(screen.getByText(CONFIRM_TEXT)).toBeTruthy();
    expect(screen.getByText(LOCAL_TEXT)).toBeTruthy();
  });

  it('renderiza um item por motivo', async () => {
    await render(
      <PixKeyFeedback check={{ type: 'cpf', status: 'suspicious', reasons: ['SEQUENTIAL_DOCUMENT'] }} />,
    );
    expect(screen.getByTestId('pix-reason-SEQUENTIAL_DOCUMENT')).toBeTruthy();
  });

  it('válido nunca diz "100% seguro"', async () => {
    await render(<PixKeyFeedback check={{ type: 'cpf', status: 'valid', reasons: [] }} />);
    expect(screen.queryByText(/100%|seguro/i)).toBeNull();
  });
});
