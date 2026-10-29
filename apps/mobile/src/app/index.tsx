import { useNetworkState } from 'expo-network';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { analyzeTarget, isAppError, sendFeedback } from '../services/api';
import { PixKeyFeedback } from '../components/PixKeyFeedback';
import { RiskCard } from '../components/RiskCard';
import type { AnalyzeResponse, FeedbackType } from '../types/api';
import { validatePixKey } from '../utils/pix';

const MAX_LENGTH = 5000;
const GENERIC_ERROR = 'Não foi possível concluir a verificação. Tente novamente.';

type ScreenState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; response: AnalyzeResponse; analyzedAt: string }
  | { status: 'error'; message: string };

/** Nunca ecoa o conteúdo digitado pelo usuário (LGPD). */
function friendlyError(e: unknown): string {
  return isAppError(e) ? e.message : GENERIC_ERROR;
}

export default function Index() {
  const [content, setContent] = useState('');
  const [state, setState] = useState<ScreenState>({ status: 'idle' });
  const [retryIn, setRetryIn] = useState(0);

  const offline = useNetworkState().isConnected === false;
  const loading = state.status === 'loading';
  // Chave Pix é validada só no aparelho: nunca vai para a API (LGPD).
  const pixCheck = useMemo(() => validatePixKey(content), [content]);
  const disabled = loading || offline || retryIn > 0 || content.trim().length === 0 || pixCheck !== null;
  const counting = retryIn > 0;

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setRetryIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  async function onSubmit() {
    if (disabled) return;
    setState({ status: 'loading' });
    try {
      const response = await analyzeTarget(content);
      setState({ status: 'success', response, analyzedAt: new Date().toISOString() });
    } catch (e) {
      setState({ status: 'error', message: friendlyError(e) });
      if (isAppError(e) && e.code === 'RATE_LIMIT_EXCEEDED' && e.retryAfterSeconds && e.retryAfterSeconds > 0) {
        setRetryIn(e.retryAfterSeconds);
      }
    }
  }

  // Só ref opaca, nível e IDs de regra: o texto digitado nunca é reenviado (LGPD).
  async function onFeedback(response: AnalyzeResponse, type: FeedbackType) {
    await sendFeedback({
      type,
      target: { type: response.type, ref: response.targetRef },
      level: response.report.level,
      signalIds: response.report.signals.map((signal) => signal.id),
    });
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="px-6 py-10" keyboardShouldPersistTaps="handled">
        <Text className="text-center text-2xl font-bold text-risk-high">Antigolpe</Text>
        <Text className="mb-6 mt-2 text-center text-base text-gray-600">
          Confira links e mensagens antes de pagar ou clicar.
        </Text>

        {offline ? (
          <View testID="offline-banner" accessible accessibilityRole="alert" className="mb-4 rounded-lg bg-amber-50 p-3">
            <Text className="text-base text-risk-attention">
              Você está sem conexão com a internet. Conecte-se para verificar links e mensagens.
            </Text>
          </View>
        ) : null}

        <TextInput
          testID="content-input"
          accessibilityLabel="Conteúdo a verificar"
          className="min-h-32 rounded-lg border border-gray-300 p-3 text-base text-gray-900"
          multiline
          textAlignVertical="top"
          autoCorrect={false}
          autoCapitalize="none"
          maxLength={MAX_LENGTH}
          placeholder="Cole aqui o link, chave Pix, telefone ou mensagem suspeita"
          value={content}
          onChangeText={setContent}
          editable={!loading}
        />

        {pixCheck !== null ? <PixKeyFeedback check={pixCheck} /> : null}

        <Pressable
          testID="submit-button"
          accessibilityRole="button"
          accessibilityLabel="Verificar"
          accessibilityState={{ busy: loading, disabled }}
          disabled={disabled}
          onPress={() => void onSubmit()}
          className={`mt-4 flex-row items-center justify-center rounded-lg px-4 py-3 ${
            disabled ? 'bg-gray-300' : 'bg-gray-900'
          }`}
        >
          {loading ? (
            <>
              <ActivityIndicator testID="loading-indicator" color="#ffffff" />
              <Text className="ml-2 text-base font-semibold text-white">Verificando…</Text>
            </>
          ) : counting ? (
            <Text testID="retry-countdown" className="text-base font-semibold text-white">
              Tente novamente em {retryIn} s
            </Text>
          ) : (
            <Text className="text-base font-semibold text-white">Verificar</Text>
          )}
        </Pressable>

        {state.status === 'error' ? (
          <View accessible accessibilityRole="alert" className="mt-4 rounded-lg bg-red-50 p-3">
            <Text className="text-base text-risk-high">{state.message}</Text>
          </View>
        ) : null}

        {state.status === 'success' ? (
          <RiskCard
            key={state.analyzedAt}
            report={state.response.report}
            analyzedAt={state.analyzedAt}
            onFeedback={(type) => onFeedback(state.response, type)}
            feedbackDisabled={offline}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
