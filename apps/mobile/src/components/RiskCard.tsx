import { Text, View } from 'react-native';

import type { AnalysisReport, RiskLevel, SignalSeverity } from '../types/api';

const LEVEL_TEXT_CLASS: Record<RiskLevel, string> = {
  HIGH_RISK: 'text-risk-high',
  NEEDS_ATTENTION: 'text-risk-attention',
  NO_KNOWN_INDICATORS: 'text-risk-none',
};

const LEVEL_BORDER_CLASS: Record<RiskLevel, string> = {
  HIGH_RISK: 'border-risk-high',
  NEEDS_ATTENTION: 'border-risk-attention',
  NO_KNOWN_INDICATORS: 'border-risk-none',
};

const SEVERITY_LABEL: Record<SignalSeverity, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Todo texto exibido vem do relatório da API; nunca do conteúdo digitado (LGPD). */
export function RiskCard({ report, analyzedAt }: { report: AnalysisReport; analyzedAt?: string }) {
  const time = formatTime(analyzedAt);
  return (
    <View
      testID="risk-card"
      accessibilityLabel={`Resultado: ${report.label}, pontuação ${report.score} de 100`}
      className={`mt-4 rounded-lg border-2 p-4 ${LEVEL_BORDER_CLASS[report.level]}`}
    >
      <View className="flex-row items-center justify-between">
        <Text testID="result-label" className={`flex-1 text-lg font-bold ${LEVEL_TEXT_CLASS[report.level]}`}>
          {report.label}
        </Text>
        <Text testID="risk-score" className="ml-3 text-base font-semibold text-gray-900">
          {`${report.score}/100`}
        </Text>
      </View>

      {time ? (
        <Text testID="analyzed-at" className="mt-1 text-xs text-gray-500">{`Analisado às ${time}`}</Text>
      ) : null}

      {report.signals.length > 0 ? (
        <View className="mt-4">
          <Text className="text-base font-semibold text-gray-900">Sinais encontrados</Text>
          {report.signals.map((signal) => (
            <View key={signal.id} testID={`signal-${signal.id}`} className="mt-2 rounded-md bg-gray-50 p-3">
              <Text className="text-sm font-semibold text-gray-900">{signal.title}</Text>
              <Text className="mt-1 text-xs text-gray-500">{`Severidade: ${SEVERITY_LABEL[signal.severity]}`}</Text>
              <Text className="mt-1 text-sm text-gray-700">{signal.explanation}</Text>
              <Text className="mt-1 text-sm text-gray-700">{signal.advice}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {report.advice.length > 0 ? (
        <View className="mt-4">
          <Text className="text-base font-semibold text-gray-900">O que fazer</Text>
          {report.advice.map((item, index) => (
            <Text key={index} className="mt-1 text-sm text-gray-700">{`• ${item}`}</Text>
          ))}
        </View>
      ) : null}

      {report.externalCheck === 'unavailable' ? (
        <Text className="mt-4 text-xs text-gray-500">
          Fonte externa indisponível; análise feita com regras locais.
        </Text>
      ) : null}

      <Text className="mt-4 text-sm text-gray-600">{report.disclaimer}</Text>
    </View>
  );
}
