import type { RiskLevel } from '../../src/core/types.js';

/** Mensagens 100% sintéticas. Nenhum dado real: links, CPFs e telefones são fictícios. */

export interface ScamMessageFixture {
  name: string;
  text: string;
  /** O relatório deve ter pelo menos este nível. */
  expectedLevel: Exclude<RiskLevel, 'NO_KNOWN_INDICATORS'>;
  /** IDs de sinais que precisam aparecer. */
  expectedSignals: string[];
}

export const SCAM_MESSAGES: ScamMessageFixture[] = [
  {
    name: 'urubu do pix: investimento relâmpago',
    text: 'Invista R$ 100 e receba R$ 500 em 1 hora! Lucro garantido, Pix na hora.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-URUBU-PIX'],
  },
  {
    name: 'urubu do pix: nome explícito',
    text: 'Urubu do Pix funcionando! Multiplique seu dinheiro hoje mesmo.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-URUBU-PIX'],
  },
  {
    name: 'urubu do pix: ganhe por dia',
    text: 'GANHE R$ 300 POR DIA sem sair de casa. Basta fazer um Pix de entrada.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-URUBU-PIX', 'MSG-PEDIDO-PIX'],
  },
  {
    name: 'código do WhatsApp por engano',
    text: 'Oi, mandei meu código de verificação do WhatsApp para você por engano, pode me passar ele?',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-CODIGO-VERIFICACAO'],
  },
  {
    name: 'código de 6 dígitos por SMS',
    text: 'Informe o código de 6 dígitos que chegou por SMS para validar seu cadastro.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-CODIGO-VERIFICACAO'],
  },
  {
    name: 'código com caracteres invisíveis (zero-width)',
    text: 'Env​ie o c‍ódigo de segur​ança que chegou no seu WhatsApp',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-CODIGO-VERIFICACAO'],
  },
  {
    name: 'código + urgência (exemplo do escopo)',
    text: 'URGENTE: sua conta será bloqueada hoje. Informe o código que chegou por SMS',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-CODIGO-VERIFICACAO', 'MSG-URGENCIA'],
  },
  {
    name: 'Correios com link falso',
    text: 'Correios: sua encomenda está retida. Pague a taxa de R$ 14,90 em correios-rastreio.online/taxa para liberar.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-FALSO-CORREIOS', 'DOM-MARCA-EMBUTIDA'],
  },
  {
    name: 'Correios taxa alfandegária com prazo',
    text: 'Última chance! Pague a taxa de desembaraço aduaneiro dos Correios até hoje.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-FALSO-CORREIOS', 'MSG-URGENCIA'],
  },
  {
    name: 'Correios pacote aguardando pagamento',
    text: 'Seu pacote está aguardando pagamento de taxa para ser liberado.',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['MSG-FALSO-CORREIOS'],
  },
  {
    name: 'Receita: CPF cancelado',
    text: 'Receita Federal: seu CPF será cancelado. Regularize a pendência agora.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-FALSO-GOV', 'MSG-URGENCIA'],
  },
  {
    name: 'Detran: multa pendente',
    text: 'Detran: você possui multa pendente. Regularize o débito do seu veículo.',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['MSG-FALSO-GOV'],
  },
  {
    name: 'valores a receber',
    text: 'Você tem valores a receber! Consulte a pendência do seu CPF para liberar o resgate.',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['MSG-FALSO-GOV'],
  },
  {
    name: 'IPVA com link falso',
    text: 'IPVA com débito em aberto. Pague em ipva-detran.top até hoje.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-FALSO-GOV', 'DOM-TLD-ALTO-RISCO'],
  },
  {
    name: 'falsa central do banco',
    text: 'Central de segurança do banco: compra suspeita de R$ 2.300. Ligue agora para confirmar.',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['MSG-FALSA-CENTRAL'],
  },
  {
    name: 'falsa central com prazo',
    text: 'Setor de fraude: transação suspeita no seu cartão. Clique no link e confirme em 24h.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-FALSA-CENTRAL', 'MSG-URGENCIA'],
  },
  {
    name: 'falso parente pedindo Pix urgente',
    text: 'Oi mãe, mudei de número. Salva esse número novo. Preciso que faça um Pix urgente, depois explico.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-FALSO-PARENTE', 'MSG-PEDIDO-PIX', 'COMBO-PARENTE-PIX'],
  },
  {
    name: 'falso parente: número novo',
    text: 'Oi pai, troquei de número, esse é meu novo número. Depois te explico tudo.',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['MSG-FALSO-PARENTE'],
  },
  {
    name: 'falso parente + pix',
    text: 'Meu número novo é esse aqui. Faz um pix pra mim rapidinho?',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['COMBO-PARENTE-PIX'],
  },
  {
    name: 'prêmio com link',
    text: 'Parabéns! Você ganhou um celular. Resgate seu prêmio em premio-gratis.xyz',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['MSG-PREMIO-FALSO', 'DOM-TLD-ALTO-RISCO'],
  },
  {
    name: 'sorteio',
    text: 'Você foi sorteado em nossa promoção da semana!',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['MSG-PREMIO-FALSO'],
  },
  {
    name: 'emprego: tarefas pagas',
    text: 'Trabalhe de casa e ganhe R$ 200 por tarefa. É só curtir vídeos e receber por Pix.',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['MSG-EMPREGO-FALSO'],
  },
  {
    name: 'emprego: depósito para ativar conta',
    text: 'Vaga: avaliar produtos, ganhe R$ 150 por tarefa. Para ativar, faça um pix de R$ 30. Responda imediatamente.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-EMPREGO-FALSO', 'MSG-PEDIDO-PIX', 'COMBO-URGENCIA-PAGAMENTO'],
  },
  {
    name: 'pedido de senha com bloqueio',
    text: 'Banco: atualize seus dados bancários e informe sua senha no link para evitar bloqueio.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-PEDIDO-CREDENCIAIS', 'MSG-URGENCIA'],
  },
  {
    name: 'caixa alta e acentos',
    text: 'URGENTE!!! SUA CONTA SERÁ BLOQUEADA HOJE. INFORME SUA SENHA PARA EVITAR O BLOQUEIO.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-PEDIDO-CREDENCIAIS', 'MSG-URGENCIA'],
  },
  {
    name: 'banco com link de marca embutida',
    text: 'Sua conta Itaú será bloqueada hoje! Acesse itau-seguranca.com e informe sua senha.',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-PEDIDO-CREDENCIAIS', 'DOM-MARCA-EMBUTIDA'],
  },
  {
    name: 'Nubank com TLD de risco',
    text: 'Nubank: sua conta foi bloqueada. Desbloqueie agora em nubank-app.xyz',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['MSG-URGENCIA', 'DOM-MARCA-EMBUTIDA'],
  },
  {
    name: 'link com typosquat',
    text: 'Confira seu extrato em bradesc0.com.br/login',
    expectedLevel: 'HIGH_RISK',
    expectedSignals: ['DOM-TYPOSQUAT'],
  },
  {
    name: 'link por IP pedindo Pix',
    text: 'Pague agora: http://45.33.12.9/pix e faça um pix de R$ 50.',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['URL-IP-LITERAL', 'MSG-PEDIDO-PIX'],
  },
  {
    name: 'link encurtado com prêmio',
    text: 'Você ganhou! Resgate seu prêmio: bit.ly/abc123',
    expectedLevel: 'NEEDS_ATTENTION',
    expectedSignals: ['MSG-PREMIO-FALSO', 'URL-ENCURTADOR'],
  },
];

export const LEGIT_MESSAGES: { name: string; text: string }[] = [
  { name: 'entrega dos Correios', text: 'Seu pedido dos Correios foi entregue.' },
  { name: 'chegada', text: 'Oi mãe, chego às 18h.' },
  { name: 'reunião', text: 'Reunião amanhã às 10h na sala 3.' },
  { name: 'fatura', text: 'Sua fatura de R$ 230 vence dia 10.' },
  { name: 'pix do almoço', text: 'Te mandei o Pix do almoço, valeu!' },
  { name: 'código real com aviso', text: 'Seu código de verificação é 482910. Não compartilhe com ninguém.' },
  { name: 'aviso do banco', text: 'Nunca informe sua senha ou código por telefone. O banco não pede esses dados.' },
  { name: 'pedir chave pix de amigo', text: 'Pode me mandar a chave Pix da Ana? Vou pagar o aluguel.' },
  { name: 'urgência de trabalho', text: 'A reunião é urgente, preciso do relatório até as 15h.' },
  { name: 'mudança de horário', text: 'Oi, mudei o horário do jantar para as 20h.' },
  { name: 'aniversário', text: 'Parabéns pelo aniversário! Que seu dia seja incrível.' },
  { name: 'compra aprovada', text: 'Compra aprovada no cartão final 1234 na padaria.' },
  { name: 'encomenda recebida', text: 'Minha encomenda chegou hoje, muito obrigado!' },
  { name: 'link gov.br oficial', text: 'Segue o link da vaga: https://www.gov.br/pt-br' },
  { name: 'receita de bolo', text: 'Receita de bolo: 2 ovos e 1 xícara de açúcar. Veja https://pt.wikipedia.org/wiki/Bolo' },
  { name: 'time', text: 'Meu time ganhou ontem!' },
];
