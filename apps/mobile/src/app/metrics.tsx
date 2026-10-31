import { useNetworkState } from 'expo-network';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { MetricsDashboard } from '../components/MetricsDashboard';
import { getMetrics, isAppError } from '../services/api';
import type { MetricsResponse } from '../types/api';

const GENERIC_ERROR = 'Não foi possível carregar o painel. Tente novamente.';
const RATE_LIMIT_ERROR = 'Muitas consultas ao painel em pouco tempo. Aguarde um pouco e tente novamente.';

type ScreenState =
  | { status: 'loading' }
  | { status: 'success'; metrics: MetricsResponse }
  | { status: 'error'; message: string };

/** Textos fixos: nunca ecoa a mensagem do servidor. */
function friendlyError(e: unknown): string {
  return isAppError(e) && e.code === 'RATE_LIMIT_EXCEEDED' ? RATE_LIMIT_ERROR : GENERIC_ERROR;
}

export default function Metrics() {
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const offline = useNetworkState().isConnected === false;

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'success', metrics: await getMetrics() });
    } catch (e) {
      setState({ status: 'error', message: friendlyError(e) });
    }
  }, []);

  useEffect(() => {
    if (!offline) void load();
  }, [offline, load]);

  const loading = state.status === 'loading' && !offline;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 py-10">
      <Text className="text-center text-2xl font-bold text-risk-high">Painel de ameaças</Text>
      <Text className="mb-6 mt-2 text-center text-base text-gray-600">
        Números anônimos das verificações feitas no Antigolpe.
      </Text>

      {offline ? (
        <View testID="offline-banner" accessible accessibilityRole="alert" className="mb-4 rounded-lg bg-amber-50 p-3">
          <Text className="text-base text-risk-attention">
            Você está sem conexão com a internet. Conecte-se para ver o painel.
          </Text>
        </View>
      ) : null}

      {loading ? <ActivityIndicator testID="metrics-loading" /> : null}

      {state.status === 'error' && !offline ? (
        <View testID="metrics-error" accessible accessibilityRole="alert" className="rounded-lg bg-red-50 p-3">
          <Text className="text-base text-risk-high">{state.message}</Text>
          <Pressable
            testID="metrics-retry"
            accessibilityRole="button"
            onPress={() => void load()}
            className="mt-3 items-center rounded-lg bg-gray-900 px-4 py-3"
          >
            <Text className="text-base font-semibold text-white">Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'success' ? <MetricsDashboard metrics={state.metrics} /> : null}

      <Pressable
        testID="metrics-refresh"
        accessibilityRole="button"
        accessibilityState={{ disabled: offline || loading }}
        disabled={offline || loading}
        onPress={() => void load()}
        className={`mt-6 items-center rounded-lg px-4 py-3 ${offline || loading ? 'bg-gray-300' : 'bg-gray-900'}`}
      >
        <Text className="text-base font-semibold text-white">Atualizar</Text>
      </Pressable>

      <Link href="/" testID="metrics-back" className="mt-4 text-center text-base text-gray-700 underline">
        Voltar para a verificação
      </Link>
    </ScrollView>
  );
}
