# 🛡️ CLAUDE.md — Diretrizes e Guia Mestre do Projeto Antifraude

Este documento é a referência principal para o assistente de IA e para a equipe de desenvolvimento. Qualquer alteração arquitetural, de dependências ou de fluxos deve ser refletida aqui.

---

## 🤖 0. Regras de Comportamento e Limite de Autonomia da IA

- **Zero Commits Automáticos:** O assistente **NUNCA** deve executar comandos de commit (`git commit`), push ou gerenciar o versionamento de forma autônoma sem permissão explícita e prévia.
- **Dúvidas Exigem Perguntas:** Caso haja qualquer ambiguidade, dúvida sobre requisitos técnicos, de negócio ou múltiplos caminhos de implementação, o assistente **deve parar e perguntar** ao usuário antes de tomar qualquer decisão.
- **Melhorias Apenas via Sugestões (Zero Ação Autônoma):** O assistente é encorajado a analisar, comentar e sugerir melhorias de código, arquitetura ou segurança, mas **nunca deve aplicar modificações por conta própria** sem a autorização expressa do desenvolvedor.

---

## 🎯 1. Visão Geral e Objetivo
- **Produto:** Aplicativo Antifraude com foco inicial no Brasil (Mobile/Web).
- **Missão:** Ajudar usuários a identificar golpes digitais (phishing, links suspeitos, chaves Pix/QR Codes falsos, engenharia social) **antes** de realizarem pagamentos ou fornecerem dados.
- **Premissa BÁSICA:** Privacidade absoluta (LGPD), minimização de dados e custo inicial zero ($0/mês).

---

## 🛑 2. Regras Invioláveis de Desenvolvimento

1. **Restrição Orçamentária Absoluta ($0):**
   * Apenas ferramentas open source e APIs gratuitas sem necessidade de cartão de crédito.
   * Não adicione bibliotecas ou serviços que exijam contas pagas ou testes que cobrem após um período.
   * Crie um sistema resiliente: se uma API externa atingir o limite ou falhar, o app DEVE continuar funcionando usando as regras locais (graceful degradation).

2. **Segurança & LGPD (Privacy by Design):**
   * **Minimização de Dados:** Nunca salve mensagens inteiras do usuário ou dados pessoais sem justificativa explícita.
   * **Sem Falsas Certezas:** O app nunca deve dizer que algo é "100% seguro". Use categorias como: `Alto Risco`, `Requer Atenção`, `Nenhum Indicador Conhecido Encontrado`.
   * **Logs Limpos:** Nunca registre senhas, CPFs, nomes, chaves Pix ou tokens nos logs.
   * **Entrada sempre sanitizada (ANTIGOL-002):** toda URL externa passa por `normalizeUrl` (`src/utils/url.ts` — allowlist http/https + anti-SSRF) e todo texto por `sanitizeText` (`src/utils/text.ts`). Antes de qualquer requisição de rede a um destino do usuário, use `assertPublicDestination`, conecte ao IP validado e revalide a cada redirect. Logs e persistência só recebem a saída de `maskSensitiveData` / `maskUrl` (`src/utils/mask.ts`).

3. **Arquitetura & Código:**
   * **Modular:** Separação clara de responsabilidades (Clean Architecture simples/Hexagonal).
   * **Trabalho Incremental:** Toda funcionalidade é dividida em pequenas tarefas com ID (ex: `ANTIGOL-001`).
   * **Sem Mudanças Destrutivas:** Não delete ou reescreva módulos funcionais sem justificativa técnica e autorização prévia.

---

## 🛠️ 3. Stack Tecnológica Recomendada (Custo Zero)

- **Backend / API:** ✅ *Definido em ANTIGOL-001* — **Node.js 24 LTS + TypeScript + Fastify 5**, validação com **Zod**, testes com **Vitest** (`app.inject()`, sem abrir porta). Motivo: mesma linguagem do app React Native/Expo (tipos e regras compartilháveis, inclusive offline como fallback), execução local simples (`npm install && npm run dev`) e logger Pino com redação de campos (LGPD).
  - Entrada: `src/index.ts` · Fábrica da app: `src/app.ts` · Configuração validada: `src/config/env.ts` · Rotas: `src/api/routes/`.
  - `CORS_ORIGIN="*"` é bloqueado em produção. Logs de requisição registram apenas id, método, caminho (sem query string), status e tempo — nunca headers, IP ou corpo.
  - ✅ *ANTIGOL-004* — `POST /api/v1/analyze` (`{type:'message'|'url', content}`, Zod em `src/api/schemas/analyze.ts`); erros sempre `{ error: { code, message, details? } }` (`src/api/errors.ts`, sem ecoar o conteúdo). Contrato completo em `docs/API.md`.
- **Frontend / Mobile:** React Native / Expo ou Flutter (Cross-platform para Android e iOS com foco inicial em formulários manuais e compartilhamento).
- **Banco de Dados Local / Cache:** SQLite (local/dev) ou PostgreSQL (Free tier / Docker local).
- **Inteligência de Ameaças (Free/Open):**
  * PhishTank API (Verificação de phishing)
  * Google Safe Browsing / Cloudflare Radar (Sinais de reputação)
  * Regras Determinísticas / Expressões Regulares (Regex) criadas internamente para identificar padrões de golpes brasileiros (ex: Pix, urubu do pix, taxas do gov, links `.top`, `.xyz`, etc.).
* **Domínios (offline):** `tldts` (MIT, Public Suffix List embutida) extrai o domínio registrável; sem chamadas de rede.
* **Mapa de `src/core/` (ANTIGOL-003):**
  * `types.ts`: `Signal`, `AnalysisReport`, níveis e rótulos PT-BR fixos.
  * `rules/`: regras de mensagem (tabela declarativa em `message-rules.ts`) e `analyzeMessageRules`.
  * `domain/`: marcas, listas (TLDs, encurtadores, palavras-isca), similaridade e `analyzeDomain`.
  * `risk/risk-scorer.ts`: pesos por severidade, teto por categoria e limiares (qualquer sinal `critical` força Alto Risco).
  * `analyzer.ts`: `analyzeMessage` e `analyzeUrl`. Adaptadores externos futuros só **somam** `Signal[]` ao scorer.

---

## 📁 4. Estrutura Padrão do Repositório

```text
antifraude-app/
├── .env.example                # Exemplo de variáveis de ambiente (sem segredos)
├── .gitignore                  # Arquivos e pastas ignorados pelo Git (ex: node_modules, .venv)
├── CLAUDE.md                   # Guia mestre da IA e regras do projeto
├── README.md                   # Apresentação do projeto para humanos
├── docs/                       # Documentação centralizada
│   ├── PRODUCT_SCOPE.md        # Escopo do MVP e regras de negócio
│   ├── ARCHITECTURE.md         # Arquitetura detalhada do sistema
│   └── ROADMAP.md              # Backlog, épicos e tarefas (ex: ANTIGOL-001)
├── src/                        # Código-fonte da aplicação
│   ├── main.py                 # (ou index.ts) Ponto de entrada / Inicialização do servidor
│   ├── api/                    # Camada de interface e rotas HTTP
│   │   ├── middlewares/        # Controles de segurança (Rate Limiter, Sanitização, LGPD)
│   │   └── routes/             # Endpoints (ex: rota de análise de links e textos)
│   ├── core/                   # Núcleo de Inteligência Antifraude (Regras de negócio puras)
│   │   ├── fraud_engine.py     # Orquestrador que junta todas as análises
│   │   ├── regex_rules.py      # Padrões de golpes no Brasil (Pix, Pix falso, Correios)
│   │   └── risk_scorer.py      # Calculador de nível de risco (Alto, Atenção, Normal)
│   ├── adapters/               # Adaptadores para serviços externos (com tolerância a falhas)
│   │   └── threat_feeds.py     # Integrações com APIs abertas (PhishTank, etc.)
│   └── utils/                  # Funções utilitárias e mascaramento de dados (LGPD)
└── tests/                      # Bateria de testes automatizados
    ├── unit/                   # Testes unitários das regras de negócio e regex
    ├── integration/            # Testes de integração das rotas da API
    └── data/                   # Massa de dados sintéticos para testes (sem dados reais)
```

---

## Diretrizes Comportamentais do Agente (Baseado em Karpathy)

- **Think Before Coding:** Antes de implementar tarefas complexas, declare explicitamente suas premissas e aponte se houver ambiguidades. Não decida sozinho em cenários ambíguos.
- **Simplicity First:** Prefira sempre a solução mais simples e direta. Sem abstrações desnecessárias, sem recursos especulativos e sem código complexo quando uma implementação enxuta resolve.
- **Surgical Changes:** Ao editar arquivos existentes, toque apenas no que for estritamente necessário para a tarefa (`ANTIGOL-XXX`). Não altere comentários adjacentes, formatações ou códigos que funcionam e não foram solicitados.
- **Goal-Driven Execution:** Foque em critérios de sucesso claros (ex: escrever testes que reproduzem o comportamento antes de implementar e garantir que o `npm test` passe de forma limpa).