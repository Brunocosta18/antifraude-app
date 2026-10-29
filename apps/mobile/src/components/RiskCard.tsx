import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { AnalysisReport, FeedbackType, RiskLevel, SignalSeverity } from '../types/api';

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

type FeedbackStatus = 'idle' | 'sending' | 'sent' | 'error';

/** Texto fixo: nunca ecoa a mensagem de erro nem o conteúdo (LGPD). */
function FeedbackSection({
  level,
  onFeedback,
  disabled,
}: {
  level: RiskLevel;
  onFeedback: (type: FeedbackType) => Promise<void>;
  disabled: boolean;
}) {
  const [status, setStatus] = useState<FeedbackStatus>('idle');

  async function send(type: FeedbackType) {
    if (status === 'sending') return;
    setStatus('sending');
    try {
      await onFeedback(type);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <Text testID="feedback-thanks" className="mt-4 text-sm text-gray-700">
        Obrigado! Seu retorno é anônimo.
      </Text>
    );
  }

  const blocked = disabled || status === 'sending';
  return (
    <View className="mt-4">
      <Text className="text-base font-semibold text-gray-900">Este resultado ajudou?</Text>
      <View className="mt-2 flex-row">
        <Pressable
          testID="feedback-scam"
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked }}
          disabled={blocked}
          onPress={() => void send('SCAM_REPORT')}
          className={`mr-2 rounded-lg border px-3 py-2 ${blocked ? 'border-gray-200' : 'border-gray-400'}`}
        >
          <Text className="text-sm text-gray-900">Isso é golpe</Text>
        </Pressable>
        {level !== 'NO_KNOWN_INDICATORS' ? (
          <Pressable
            testID="feedback-false-positive"
            accessibilityRole="button"
            accessibilityState={{ disabled: blocked }}
            disabled={blocked}
            onPress={() => void send('FALSE_POSITIVE')}
            className={`rounded-lg border px-3 py-2 ${blocked ? 'border-gray-200' : 'border-gray-400'}`}
          >
            <Text className="text-sm text-gray-900">Falso positivo</Text>
          </Pressable>
        ) : null}
      </View>
      {status === 'error' ? (
        <Text testID="feedback-error" className="mt-2 text-xs text-risk-high">
          Não foi possível enviar agora. Tente novamente.
        </Text>
      ) : null}
    </View>
  );
}

/** Todo texto exibido vem do relatório da API; nunca do conteúdo digitado (LGPD). */
export function RiskCard({
  report,
  analyzedAt,
  onFeedback,
  feedbackDisabled = false,
}: {
  report: AnalysisReport;
  analyzedAt?: string;
  onFeedback?: (type: FeedbackType) => Promise<void>;
  feedbackDisabled?: boolean;
}) {
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

      {onFeedback ? <FeedbackSection level={report.level} onFeedback={onFeedback} disabled={feedbackDisabled} /> : null}

      <Text className="mt-4 text-sm text-gray-600">{report.disclaimer}</Text>
    </View>
  );
}
