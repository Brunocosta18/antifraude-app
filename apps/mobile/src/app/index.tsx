import { useState } from 'react';
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

import { analyzeTarget, isAppError } from '../services/api';
import { RiskCard } from '../components/RiskCard';
import type { AnalyzeResponse } from '../types/api';

const MAX_LENGTH = 5000;
const GENERIC_ERROR = 'Não foi possível concluir a verificação. Tente novamente.';

/** Nunca ecoa o conteúdo digitado pelo usuário (LGPD). */
function friendlyError(e: unknown): string {
  return isAppError(e) ? e.message : GENERIC_ERROR;
}

export default function Index() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const disabled = loading || content.trim().length === 0;

  async function onSubmit() {
    if (disabled) return;
    setErrorMessage(null);
    setResult(null);
    setLoading(true);
    try {
      const response = await analyzeTarget(content);
      setResult(response);
      setAnalyzedAt(new Date().toISOString());
    } catch (e) {
      setErrorMessage(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="px-6 py-10" keyboardShouldPersistTaps="handled">
        <Text className="text-center text-2xl font-bold text-risk-high">Antigolpe</Text>
        <Text className="mb-6 mt-2 text-center text-base text-gray-600">
          Confira links e mensagens antes de pagar ou clicar.
        </Text>

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
          ) : (
            <Text className="text-base font-semibold text-white">Verificar</Text>
          )}
        </Pressable>

        {errorMessage ? (
          <View accessible accessibilityRole="alert" className="mt-4 rounded-lg bg-red-50 p-3">
            <Text className="text-base text-risk-high">{errorMessage}</Text>
          </View>
        ) : null}

        {result ? (
          <RiskCard report={result.report} analyzedAt={analyzedAt} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
