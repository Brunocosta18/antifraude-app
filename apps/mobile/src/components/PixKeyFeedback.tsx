import { Text, View } from 'react-native';

import type { PixKeyCheck, PixKeyStatus, PixKeyType, PixReason } from '../utils/pix';

const STATUS_TEXT_CLASS: Record<PixKeyStatus, string> = {
  invalid: 'text-risk-high',
  suspicious: 'text-risk-attention',
  valid: 'text-gray-900',
};

const STATUS_BORDER_CLASS: Record<PixKeyStatus, string> = {
  invalid: 'border-risk-high',
  suspicious: 'border-risk-attention',
  valid: 'border-gray-300',
};

const TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'e-mail',
  phone: 'telefone',
  evp: 'chave aleatória',
};

const STATUS_TITLE: Record<PixKeyStatus, (type: PixKeyType) => string> = {
  invalid: (type) => `Chave Pix inválida (${TYPE_LABEL[type]})`,
  suspicious: (type) => `Chave Pix requer atenção (${TYPE_LABEL[type]})`,
  valid: (type) => `Formato de chave Pix válido (${TYPE_LABEL[type]})`,
};

const REASON_TEXT: Record<PixReason, string> = {
  INVALID_FORMAT: 'O formato não corresponde a uma chave Pix válida. Confira se digitou corretamente.',
  INVALID_CHECK_DIGITS: 'Os dígitos verificadores não conferem: o número não existe. Confira com quem pediu o Pix.',
  SEQUENTIAL_DOCUMENT: 'O número está em sequência (como 123456789), padrão comum em documentos falsos.',
  BRAND_IMPERSONATION:
    'O e-mail é gratuito e cita o nome de uma empresa conhecida. Empresas de verdade usam e-mail do próprio domínio.',
  FOREIGN_PHONE: 'O telefone não é do Brasil (+55). Desconfie de pedidos de Pix para números estrangeiros.',
};

/** Todo texto é fixo por tipo, status e motivo; a chave digitada nunca é exibida (LGPD). */
export function PixKeyFeedback({ check }: { check: PixKeyCheck }) {
  return (
    <View
      testID="pix-feedback"
      accessible
      accessibilityRole="alert"
      className={`mt-4 rounded-lg border-2 p-4 ${STATUS_BORDER_CLASS[check.status]}`}
    >
      <Text testID={`pix-status-${check.status}`} className={`text-base font-bold ${STATUS_TEXT_CLASS[check.status]}`}>
        {STATUS_TITLE[check.status](check.type)}
      </Text>

      {check.reasons.map((reason) => (
        <Text key={reason} testID={`pix-reason-${reason}`} className="mt-2 text-sm text-gray-700">
          {REASON_TEXT[reason]}
        </Text>
      ))}

      <Text className="mt-3 text-sm font-semibold text-gray-900">
        Confira o nome e o banco do recebedor antes de confirmar o Pix
      </Text>
      <Text className="mt-1 text-xs text-gray-500">A chave foi verificada só no seu aparelho</Text>
    </View>
  );
}
