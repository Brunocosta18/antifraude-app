import { Text, View } from 'react-native';

import type { MetricsResponse, RiskLevel, SignalCategory } from '../types/api';

const LEVELS: readonly RiskLevel[] = ['HIGH_RISK', 'NEEDS_ATTENTION', 'NO_KNOWN_INDICATORS'];

/** Rótulos PT-BR fixos (espelham RISK_LABELS da API). */
const LEVEL_LABEL: Record<RiskLevel, string> = {
  HIGH_RISK: 'Alto Risco',
  NEEDS_ATTENTION: 'Requer Atenção',
  NO_KNOWN_INDICATORS: 'Nenhum Indicador Conhecido Encontrado',
};

// Classes literais: o Tailwind só gera o que aparece por extenso no código.
const LEVEL_BAR_CLASS: Record<RiskLevel, string> = {
  HIGH_RISK: 'bg-risk-high',
  NEEDS_ATTENTION: 'bg-risk-attention',
  NO_KNOWN_INDICATORS: 'bg-risk-none',
};

const CATEGORY_LABEL: Record<SignalCategory, string> = {
  easy_money: 'Dinheiro fácil',
  fake_billing: 'Cobrança falsa',
  urgency: 'Urgência',
  credential_request: 'Pedido de dados ou senha',
  impersonation: 'Falsa identidade',
  payment_pressure: 'Pressão para pagar',
  fake_prize: 'Prêmio falso',
  fake_job: 'Vaga falsa',
  domain: 'Domínio suspeito',
  url_structure: 'Estrutura do link',
  threat_intel: 'Lista de ameaças conhecidas',
};

function Kpi({ testID, label, value }: { testID: string; label: string; value: number }) {
  return (
    <View className="min-w-[45%] flex-1 rounded-lg border border-gray-200 p-3">
      <Text testID={testID} className="text-2xl font-bold text-gray-900">
        {value}
      </Text>
      <Text className="text-sm text-gray-600">{label}</Text>
    </View>
  );
}

function percent(value: number, total: number): `${number}%` {
  return `${total > 0 ? Math.round((value / total) * 100) : 0}%`;
}

/** Apresentação pura das métricas agregadas: só contagens, nada digitado pelo usuário. */
export function MetricsDashboard({ metrics }: { metrics: MetricsResponse }) {
  const { analyses, levels, categories, feedback, since } = metrics;
  const topCategories = (Object.entries(categories) as [SignalCategory, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxCategory = topCategories[0]?.[1] ?? 0;

  return (
    <View>
      <View className="flex-row flex-wrap gap-3">
        <Kpi testID="metrics-total" label="Análises" value={analyses.total} />
        <Kpi testID="metrics-messages" label="Mensagens" value={analyses.byType.message} />
        <Kpi testID="metrics-urls" label="Links" value={analyses.byType.url} />
        <Kpi testID="metrics-scam-reports" label="Golpes reportados" value={feedback.scamReports} />
        <Kpi testID="metrics-false-positives" label="Falsos positivos" value={feedback.falsePositives} />
      </View>

      {analyses.total === 0 ? (
        <Text testID="metrics-empty" className="mt-6 text-center text-base text-gray-600">
          Ainda não há análises registradas
        </Text>
      ) : (
        <>
          <Text className="mb-2 mt-6 text-lg font-semibold text-gray-900">Resultados por nível</Text>
          {LEVELS.map((level) => (
            <View key={level} testID={`metrics-level-${level}`} className="mb-3">
              <Text className="text-sm text-gray-800">
                {LEVEL_LABEL[level]}: {levels[level]}
              </Text>
              <View className="mt-1 h-3 overflow-hidden rounded-full bg-gray-100">
                <View
                  testID={`metrics-level-${level}-bar`}
                  className={`h-3 rounded-full ${LEVEL_BAR_CLASS[level]}`}
                  style={{ width: percent(levels[level], analyses.total) }}
                />
              </View>
            </View>
          ))}

          {topCategories.length > 0 ? (
            <>
              <Text className="mb-2 mt-4 text-lg font-semibold text-gray-900">Tipos de sinal mais comuns</Text>
              {topCategories.map(([category, count]) => (
                <View key={category} testID={`metrics-category-${category}`} className="mb-3">
                  <Text className="text-sm text-gray-800">
                    {CATEGORY_LABEL[category]}: {count}
                  </Text>
                  <View className="mt-1 h-3 overflow-hidden rounded-full bg-gray-100">
                    <View
                      className="h-3 rounded-full bg-risk-attention"
                      style={{ width: percent(count, maxCategory) }}
                    />
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </>
      )}

      <Text className="mt-6 text-sm text-gray-500">
        Dados agregados e anônimos desde {since}; zeram quando o servidor reinicia.
      </Text>
    </View>
  );
}
