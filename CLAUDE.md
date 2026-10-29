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
  - ✅ *ANTIGOL-012* — Containerização: `apps/api/Dockerfile` (3 stages `node:24-alpine`: build / deps prod / runtime), `.dockerignore` e `docker-compose.yml` na raiz. Comandos: `docker compose up --build` e `npm run docker:smoke` (health 200, usuário `node`, exit code 0 no stop). Padrões: contexto de build = raiz (código não foi movido); `.dockerignore` em modo allowlist (`*` + exceções); `USER node`; `CMD` em exec-form (`node dist/index.js`) para o SIGTERM chegar ao Node (graceful shutdown); `HOST=0.0.0.0` no container; `CORS_ORIGIN` explícito em produção (`*` é rejeitado); segredos (`URLHAUS_AUTH_KEY`) só em runtime, nunca em `ARG`/`ENV` da imagem; compose com `read_only`, `cap_drop: ALL` e `no-new-privileges`. Teste estático em `tests/infra/docker.test.ts`.
  - ✅ *ANTIGOL-013* — CI em `.github/workflows/ci.yml` (GitHub Actions, $0, sem segredos): gatilhos `push` na `main` + `pull_request`; 3 jobs paralelos em `ubuntu-latest` com `timeout-minutes` — `api` (`npm ci`, `npm run typecheck`, `npm test`), `mobile` (`apps/mobile`: `npm ci`, `npm run typecheck`, `npm test -- --ci`) e `docker` (`npm run docker:smoke`). Padrões: Node 24 com `cache: npm`; `permissions: contents: read`; `concurrency` por ref com `cancel-in-progress`; nenhum `secrets.*` nem `URLHAUS_AUTH_KEY` (feed desligado = graceful degradation). Script `typecheck` adicionado ao `apps/mobile/package.json`. Teste estático em `tests/infra/ci.test.ts`.
  - ✅ *ANTIGOL-014* — Deploy no **Render Free** ($0, sem cartão) via Blueprint `render.yaml` na raiz (`runtime: docker`, `dockerfilePath: ./apps/api/Dockerfile`, `dockerContext: .`, `healthCheckPath: /health`, `autoDeployTrigger: checksPass` = só publica após o CI). Nova env `TRUST_PROXY` (`true` | `false` | inteiro 1–10, padrão `false`; em produção `1`) exposta como `trustProxy` e repassada ao Fastify em `src/app.ts` (número vira função de saltos, pois o Fastify 5 ignora `trustProxy` numérico) para o rate limit (ANTIGOL-006) usar o IP real atrás do proxy; o serializer de logs continua sem IP. Segredos (`URLHAUS_AUTH_KEY`) e `CORS_ORIGIN` com `sync: false`: preenchidos só no painel, nunca no repositório. Guia em `docs/DEPLOY.md` (limitações do Free: hibernação, contadores zeram no restart). Teste estático em `tests/infra/render.test.ts`.
- **Frontend / Mobile:** ✅ *ANTIGOL-007* — **Expo (SDK 58) + Expo Router + NativeWind v4 (Tailwind CSS v3)** em `apps/mobile/` (package.json próprio; testes com **jest-expo**, `npm test` dentro da pasta).
  - Rotas: `apps/mobile/src/app/` · Componentes: `src/components/` · Tipos do contrato da API: `src/types/api.ts` · Cliente HTTP: `src/services/api.ts`.
  - `api.ts`: `EXPO_PUBLIC_API_URL`, timeout de 10s (`AbortController`), `AppError` (`code`, `status`, `details`, `retryAfterSeconds`) com códigos do backend + `TIMEOUT | NETWORK_ERROR | INVALID_RESPONSE`; 429 → `RATE_LIMIT_EXCEEDED` lendo `Retry-After`. Nenhum `console.*` e nenhuma lib de analytics/rastreamento (LGPD).
  - ✅ *ANTIGOL-008* — tela de análise em `src/app/index.tsx`; `analyzeTarget` com detecção automática url/message; testes de tela com RNTL (em `src/__tests__/`, fora de `src/app/` para não virarem rotas).
  - ✅ *ANTIGOL-009* — `RiskCard` em `src/components/RiskCard.tsx` recebe `AnalysisReport` + `analyzedAt?` (ISO, horário local gerado no cliente; fora do contrato da API). Cores por `level` com classes literais (`text-/border-risk-none|attention|high`); seções vazias são omitidas; todo texto vem do relatório da API, nunca do input. Testes em `src/__tests__/RiskCard.test.tsx`.
  - ✅ *ANTIGOL-010* — `src/app/index.tsx` usa estado explícito `idle | loading | success | error`. No 429 com `Retry-After` > 0 o botão fica bloqueado com contagem regressiva (`Tente novamente em N s`, testID `retry-countdown`); sem `Retry-After`, apenas a mensagem. Teste de integração em `src/__tests__/integration.test.tsx` (tela + `api.ts` real com `fetch` simulado: NETWORK_ERROR, TIMEOUT, 429, 200 e LGPD).
  - ✅ *ANTIGOL-011* — PWA sem Service Worker: manifest em `public/manifest.json` (+ ícones 192/512 em `public/icons/`) e `src/app/+html.tsx` (theme-color `#208AEF`, `display: standalone`, `lang pt-BR`; as chaves PWA de `app.json > web` são ignoradas pelo Metro). Modo offline via `expo-network` `useNetworkState`: `isConnected === false` mostra `offline-banner` e desabilita o botão (nenhuma requisição é enviada); `undefined` conta como online. Testes em `src/__tests__/offline.test.tsx` e `pwa.test.ts`.
  - ✅ *ANTIGOL-015* — Deploy da PWA na **Vercel Hobby** ($0, sem cartão) como site estático: `apps/mobile/app.json` com `web.output: "static"` (o modo `server` exigiria adapter) e script `export:web` (`expo export -p web` → `apps/mobile/dist/`, no `.gitignore`). `apps/mobile/vercel.json` (Root Directory = `apps/mobile` no painel; `framework: null`, `buildCommand: npm run export:web`, `outputDirectory: dist`) com rewrite de SPA para `/index.html` e headers: segurança em `/(.*)` (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS), `application/manifest+json` em `/manifest.json` e cache `immutable` em `/_expo/static/`. `EXPO_PUBLIC_API_URL` só no painel (embutida no bundle **no build**; mudar exige redeploy; nunca segredo) e `CORS_ORIGIN` do Render = domínio da Vercel (sem `*`). LGPD: Web Analytics/Speed Insights desligados, sem `@vercel/*` nem chave `env` no `vercel.json`, sem função serverless (conteúdo só no corpo do POST). Guia em `docs/DEPLOY.md` (cold start do Render aparece como timeout de 10s; deploy da Vercel não espera o CI). Teste estático em `tests/infra/vercel.test.ts`.
  - O `vitest.config.ts` da raiz restringe o Vitest do backend a `tests/`.
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
├── .dockerignore               # Allowlist do contexto de build Docker
├── docker-compose.yml          # Execução local da API em container
├── .github/workflows/ci.yml    # CI (GitHub Actions): api, mobile e docker em paralelo
├── apps/api/Dockerfile         # Imagem multi-stage da API (contexto = raiz)
├── scripts/docker-smoke.mjs    # Smoke test da imagem (npm run docker:smoke)
├── render.yaml                 # Blueprint de deploy no Render Free (ANTIGOL-014)
├── apps/mobile/vercel.json     # Deploy estático da PWA na Vercel Hobby (ANTIGOL-015)
├── docs/                       # Documentação centralizada
│   ├── PRODUCT_SCOPE.md        # Escopo do MVP e regras de negócio
│   ├── ARCHITECTURE.md         # Arquitetura detalhada do sistema
│   ├── API.md                  # Contrato da API e descrições de endpoints
│   ├── DEPLOY.md               # Guia de deploy: Render (API) + Vercel (PWA), $0
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