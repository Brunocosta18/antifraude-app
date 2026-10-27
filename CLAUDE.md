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

- **Backend / API:** ✅ *Definido em ANTIGOL-001 até ANTIGOL-006* — **Node.js 24 LTS + TypeScript + Fastify 5**, validação com **Zod**, testes com **Vitest** (`app.inject()`, sem abrir porta). 
  - Entrada: `src/index.ts` · Fábrica da app: `src/app.ts` · Configuração validada: `src/config/env.ts` (incluindo `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW_MS`) · Rotas: `src/api/routes/`.
  - CORS e logs de requisição LGPD-compliant.
  - ✅ *ANTIGOL-004* — `POST /api/v1/analyze` (`{type:'message'|'url', content}`, Zod em `src/api/schemas/analyze.ts`); erros padronizados em `src/api/errors.ts`. Contrato em `docs/API.md`.
  - ✅ *ANTIGOL-005* — Threat feed URLhaus (abuse.ch, `URLHAUS_AUTH_KEY`): porta `ThreatFeed` em `src/core/types.ts`, adapter em `src/adapters/urlhaus.ts`. Timeout ≤ 2s, `report.externalCheck` = `checked | unavailable | disabled`. Graceful degradation para regras locais em caso de falha.
  - ✅ *ANTIGOL-006* — Rate limit por IP em `POST /api/v1/analyze` (`@fastify/rate-limit`, `global: false`, MIT, $0): configurado via `RATE_LIMIT_MAX` (padrão 30) e `RATE_LIMIT_WINDOW_MS` (padrão 60000). Excedido → 429 `RATE_LIMIT_EXCEEDED` via `ApiError` + headers padrão `X-RateLimit-*`/`Retry-After`. Rota `/health` isenta.
- **Frontend / Mobile:** React Native / Expo ou Flutter (Próxima fase — ANTIGOL-007+).
- **Banco de Dados Local / Cache:** SQLite (local/dev) ou PostgreSQL (Free tier / Docker local).
- **Inteligência de Ameaças (Free/Open):**
  * URLhaus Threat Feed (Integrado - ANTIGOL-005)
  * Regras Determinísticas / Expressões Regulares (Regex) criadas internamente para identificar padrões de golpes brasileiros.
- **Domínios (offline):** `tldts` (MIT, Public Suffix List embutida).

---

## 📁 4. Estrutura Padrão do Repositório

```text
antifraude-app/
├── .env.example                # Exemplo de variáveis de ambiente (sem segredos)
├── .gitignore                  # Arquivos e pastas ignorados pelo Git
├── CLAUDE.md                   # Guia mestre da IA e regras do projeto
├── README.md                   # Apresentação do projeto para humanos
├── docs/                       # Documentação centralizada
│   ├── PRODUCT_SCOPE.md        # Escopo do MVP e regras de negócio
│   ├── ARCHITECTURE.md         # Arquitetura detalhada do sistema
│   ├── API.md                  # Contrato da API e descrições de endpoints
│   └── ROADMAP.md              # Backlog, épicos e tarefas (ANTIGOL-001 a 015+)
├── src/                        # Código-fonte da aplicação
│   ├── index.ts                # Ponto de entrada / Inicialização do servidor
│   ├── app.ts                  # Fábrica da aplicação Fastify
│   ├── config/                 # Configurações validadas com Zod (env.ts)
│   ├── api/                    # Camada de interface e rotas HTTP
│   │   ├── plugins/            # Plugins do Fastify (rateLimit.ts)
│   │   ├── routes/             # Endpoints (analyze.ts, health.ts)
│   │   └── errors.ts           # Tratamento padronizado de erros
│   ├── core/                   # Núcleo de Inteligência Antifraude (Regras puras)
│   ├── adapters/               # Adaptadores para serviços externos (URLhaus, etc.)
│   └── utils/                  # Funções utilitárias e mascaramento de dados (LGPD)
└── tests/                      # Bateria de testes automatizados (Vitest)
```

---

## Diretrizes Comportamentais do Agente (Baseado em Karpathy)

- **Think Before Coding:** Antes de implementar tarefas complexas, declare explicitamente suas premissas e aponte se houver ambiguidades. Não decida sozinho em cenários ambíguos.
- **Simplicity First:** Prefira sempre a solução mais simples e direta. Sem abstrações desnecessárias, sem recursos especulativos e sem código complexo quando uma implementação enxuta resolve.
- **Surgical Changes:** Ao editar arquivos existentes, toque apenas no que for estritamente necessário para a tarefa (`ANTIGOL-XXX`). Não altere comentários adjacentes, formatações ou códigos que funcionam e não foram solicitados.
- **Goal-Driven Execution:** Foque em critérios de sucesso claros (ex: escrever testes que reproduzem o comportamento antes de implementar e garantir que o `npm test` passe de forma limpa).