import type { Severity, SignalCategory } from '../types.js';

/**
 * Regras determinísticas de engenharia social (golpes comuns no Brasil).
 * Tabela declarativa: as regex rodam sobre `normalizeForMatching(texto)` (minúsculas, sem acento),
 * usam só alternâncias e quantificadores limitados (sem aninhamento, sem backtracking perigoso).
 */

/** Um gatilho casa quando QUALQUER `anyOf` casa e TODOS os `allOf` casam. */
export interface Trigger {
  anyOf: RegExp[];
  allOf?: RegExp[];
}

export interface MessageRule {
  id: string;
  category: SignalCategory;
  severity: Severity;
  /** Sobrescreve o peso padrão da severidade. */
  weight?: number;
  /** A regra casa se QUALQUER gatilho casar. */
  triggers: Trigger[];
  /** Se qualquer uma casar, a regra é ignorada (ex.: "nunca informe seu código" é um aviso legítimo). */
  noneOf?: RegExp[];
  title: string;
  explanation: string;
  advice: string;
}

export interface ComboRule {
  id: string;
  category: SignalCategory;
  severity: Severity;
  weight?: number;
  /** Todos estes IDs precisam ter disparado. */
  requires: string[];
  /** Pelo menos um destes IDs também precisa ter disparado. */
  requiresAny?: string[];
  title: string;
  explanation: string;
  advice: string;
}

/** Avisos legítimos de bancos ("nunca informe sua senha") não devem virar alerta. */
const WARNING_AGAINST_SHARING =
  /\b(?:nao|nunca|jamais) (?:\w+ ){0,2}(?:informe|informar|envie|enviar|passe|passar|repasse|repassar|compartilhe|compartilhar|forneca|digite|mande|mandar|diga)\b/;

const BAIT_CONTEXT = /\b(?:conta|cartao|pix|pagamento|banco|cpf|bloque\w*|acesso|dados|compra|fatura|boleto|cadastro)\b/;

export const MESSAGE_RULES: readonly MessageRule[] = [
  {
    id: 'MSG-URUBU-PIX',
    category: 'easy_money',
    severity: 'critical',
    triggers: [
      {
        anyOf: [
          /\burubu do pix\b/,
          /\bmultiplic(?:a|o|ar|e) (?:o |seu |seus )?(?:dinheiro|pix)\b/,
          /\binvista r\$ ?\d[\d.,]* e receba\b/,
          /\b(?:lucro|retorno|rendimento) garantido\b/,
          /\bganhe r\$ ?\d[\d.,]* por (?:dia|hora)\b/,
        ],
      },
    ],
    title: 'Promessa de dinheiro fácil',
    explanation:
      'Promessas de multiplicar dinheiro ou de lucro garantido são típicas do golpe do "urubu do Pix" e de pirâmides.',
    advice: 'Não faça Pix para receber "mais" depois. Nenhum investimento sério garante lucro.',
  },
  {
    id: 'MSG-CODIGO-VERIFICACAO',
    category: 'credential_request',
    severity: 'critical',
    triggers: [
      {
        anyOf: [/\bcodigo\b/],
        allOf: [
          /\b(?:verificacao|seguranca|sms|whatsapp|6 digitos|seis digitos)\b/,
          /\b(?:envie|informe|passa|passe|passar|manda|mande|mandar|enviar|informar|repassa|repasse|repassar|confirma|confirme|me diga|fale)\b/,
        ],
      },
    ],
    noneOf: [WARNING_AGAINST_SHARING],
    title: 'Pedido de código de verificação',
    explanation: 'Quem pede o código que chegou por SMS ou WhatsApp quer clonar sua conta ou acessar seu banco.',
    advice: 'Nunca repasse códigos de verificação, nem para quem diz ser de empresa ou conhecido.',
  },
  {
    id: 'MSG-PEDIDO-CREDENCIAIS',
    category: 'credential_request',
    severity: 'high',
    // Pedir senha/token é o pior caso da severidade `high`: com urgência (outra categoria) já é Alto Risco.
    weight: 40,
    triggers: [
      {
        anyOf: [
          /\b(?:informe|confirme|atualize|digite|envie|passe|forneca) (?:a |o |sua |seu |seus |suas )?(?:senha|token|dados bancarios|numero do cartao|cvv)\b/,
        ],
      },
    ],
    noneOf: [WARNING_AGAINST_SHARING],
    title: 'Pedido de senha ou dados sensíveis',
    explanation: 'Empresas sérias não pedem senha, token ou dados do cartão por mensagem.',
    advice: 'Não informe senhas nem dados do cartão. Entre em contato pelo app ou telefone oficial.',
  },
  {
    id: 'MSG-FALSO-CORREIOS',
    category: 'fake_billing',
    severity: 'high',
    triggers: [
      {
        anyOf: [/\b(?:correios|encomenda|pacote)\b/],
        allOf: [/\b(?:taxa|tributo|retid[oa]|aguardando pagamento|desembaraco|alfandeg\w*)/],
      },
    ],
    title: 'Cobrança de taxa de encomenda',
    explanation: 'Golpistas fingem ser dos Correios e cobram "taxas" para liberar uma encomenda que não existe.',
    advice: 'Confira o código de rastreio no site oficial dos Correios e não pague por links recebidos.',
  },
  {
    id: 'MSG-FALSO-GOV',
    category: 'impersonation',
    severity: 'high',
    triggers: [
      {
        anyOf: [/\b(?:receita federal|detran|valores a receber|ipva)\b/, /\bgov\.br\b/],
        allOf: [/\b(?:pendencia|regulariz\w*|debito|multa|irregular\w*|bloquead[oa]|cancelad[oa])/],
      },
      { anyOf: [/\bcpf (?:sera |foi |esta )?(?:cancelado|bloqueado|irregular|suspenso)\b/] },
    ],
    title: 'Falsa cobrança do governo',
    explanation: 'Mensagens sobre CPF, Receita, Detran ou "valores a receber" com ameaça de bloqueio são golpes comuns.',
    advice: 'Consulte sua situação apenas digitando o endereço oficial (gov.br) no navegador.',
  },
  {
    id: 'MSG-FALSA-CENTRAL',
    category: 'impersonation',
    severity: 'high',
    triggers: [
      {
        anyOf: [/\b(?:central de seguranca|setor de fraude|(?:compra|transacao) suspeita)\b/],
        allOf: [/\b(?:ligue|clique|confirme|acesse)\b/],
      },
    ],
    title: 'Falsa central do banco',
    explanation: 'Golpistas se passam pelo banco avisando de "compra suspeita" para você ligar ou clicar em um link.',
    advice: 'Desligue e ligue você mesmo para o número que está no verso do seu cartão.',
  },
  {
    id: 'MSG-FALSO-PARENTE',
    category: 'impersonation',
    severity: 'medium',
    triggers: [
      {
        anyOf: [
          /\b(?:mudei|troquei) de numero\b/,
          /\bmeu numero novo\b/,
          /\bsalva (?:esse|este|meu) numero\b/,
          /\b(?:esse|este) e (?:o )?meu novo numero\b/,
        ],
      },
    ],
    title: 'Pedido de "novo número"',
    explanation: 'No golpe do falso parente, o criminoso diz que mudou de número e logo depois pede dinheiro.',
    advice: 'Ligue para o número antigo ou faça uma chamada de vídeo antes de qualquer transferência.',
  },
  {
    id: 'MSG-PREMIO-FALSO',
    category: 'fake_prize',
    severity: 'medium',
    triggers: [
      {
        anyOf: [
          /\bvoce (?:ganhou|foi sorteado|foi sorteada|foi premiado|foi premiada)\b/,
          /\bparabens\b.{0,40}\b(?:ganhou|sorteado|sorteada|premiado|premiada)\b/,
          /\bresgat(?:e|ar) (?:o |seu )?premio\b/,
        ],
      },
    ],
    title: 'Prêmio ou sorteio inesperado',
    explanation: 'Prêmios que você não pediu costumam ser isca para roubar dados ou cobrar uma "taxa de liberação".',
    advice: 'Não clique e não pague nada para receber prêmios.',
  },
  {
    id: 'MSG-EMPREGO-FALSO',
    category: 'fake_job',
    severity: 'high',
    triggers: [
      {
        anyOf: [
          /\b(?:curtir|curtindo|avaliar) (?:videos|produtos|posts)\b/,
          /\bganhe r\$ ?\d[\d.,]* por (?:tarefa|curtida|avaliacao)\b/,
          /\btrabalhe de casa\b/,
        ],
        allOf: [/\b(?:r\$|pix|ganh\w*)/],
      },
    ],
    title: 'Oferta de trabalho com pagamento fácil',
    explanation: 'Ofertas de dinheiro por tarefas simples (curtir vídeos) costumam terminar com pedido de depósito.',
    advice: 'Desconfie de vagas que pagam muito por pouco esforço ou pedem dinheiro adiantado.',
  },
  {
    id: 'MSG-URGENCIA',
    category: 'urgency',
    severity: 'medium',
    triggers: [
      {
        anyOf: [
          /\b(?:sera|vai ser|foi) (?:bloquead|cancelad|suspens)/,
          /\bultimo aviso\b/,
          /\bevit(?:e|ar) (?:o )?bloqueio\b/,
          /\b(?:pague|regularize|atualize|confirme|resgate|responda)\b.{0,60}\bate (?:hoje|as \d+)/,
        ],
      },
      {
        anyOf: [/\burgente\b/, /\bimediatamente\b/, /\bem (?:ate )?24 ?(?:h|horas)\b/],
        allOf: [BAIT_CONTEXT],
      },
    ],
    title: 'Pressão para agir rápido',
    explanation: 'Golpistas criam urgência para você agir sem pensar ou checar.',
    advice: 'Pare e respire. Empresas de verdade não exigem decisões em minutos por mensagem.',
  },
  {
    id: 'MSG-PEDIDO-PIX',
    category: 'payment_pressure',
    severity: 'low',
    triggers: [
      {
        anyOf: [
          /\b(?:faz|faca|manda|mande|fazer) (?:um )?pix\b/,
          /\bchave pix\b/,
          /\bpague (?:via|por|com) pix\b/,
          /\bqr ?code\b/,
        ],
      },
    ],
    title: 'Pedido de pagamento por Pix',
    explanation: 'Pix é imediato e difícil de reverter, por isso é o preferido dos golpistas.',
    advice: 'Confira nome e valor na tela de confirmação do Pix antes de pagar.',
  },
];

export const COMBO_RULES: readonly ComboRule[] = [
  {
    id: 'COMBO-PARENTE-PIX',
    category: 'payment_pressure',
    severity: 'high',
    weight: 40,
    requires: ['MSG-FALSO-PARENTE', 'MSG-PEDIDO-PIX'],
    title: 'Novo número pedindo Pix',
    explanation: 'Alguém que diz ter mudado de número e pede Pix é o roteiro clássico do golpe do falso parente.',
    advice: 'Não faça o Pix. Confirme a identidade por ligação ou vídeo no número antigo.',
  },
  {
    id: 'COMBO-URGENCIA-PAGAMENTO',
    category: 'payment_pressure',
    severity: 'medium',
    weight: 30,
    requires: ['MSG-URGENCIA'],
    requiresAny: ['MSG-PEDIDO-PIX', 'MSG-FALSO-CORREIOS', 'MSG-FALSO-GOV', 'MSG-FALSA-CENTRAL', 'MSG-FALSO-PARENTE'],
    title: 'Urgência junto com pedido de pagamento',
    explanation: 'Pressa somada a uma cobrança é a combinação mais usada em golpes.',
    advice: 'Não pague sob pressão. Confirme a cobrança por um canal oficial.',
  },
];
