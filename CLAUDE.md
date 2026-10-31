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
  - ✅ *ANTIGOL-016 (API)* — Feed **Phishing.Database** (lista pública de domínios de phishing ativos, MIT, sem chave) em `src/adapters/phishing-database.ts`: o servidor baixa `phishing-domains-ACTIVE.txt` de `raw.githubusercontent.com` (~11 MB; limite `MAX_LIST_BYTES` = 24 MB, timeout 30 s, `redirect: 'error'`, corte de bytes no stream) e consulta **só em memória** (`check` não faz rede; nenhum dado do usuário sai do servidor). Testa o hostname e os domínios pais até o registrável (`tldts`), ignora plataformas compartilhadas e marcas oficiais; sinal `TI-PHISHDB-DOMAIN` (`threat_intel`, `high`). `start()` baixa em segundo plano (não bloqueia o boot) e atualiza a cada `PHISHING_DB_REFRESH_MS` (1 h a 24 h, padrão 6 h; `setInterval().unref()`); se o refresh falha, mantém a lista anterior e loga só `{ feed, reason, httpStatus? }`; antes do 1º download responde `unavailable`. `PHISHING_DB_ENABLED` (padrão `false`, para testes/CI não usarem rede; `true` no `render.yaml`). Peças comuns (`FeedFailure`, `isTrustedHost`, `readLimitedText`, `FeedLogger`) extraídas para `src/adapters/shared.ts`. Composição em `src/adapters/composite-feed.ts` (`combineFeeds`: consulta em paralelo, junta sinais; algum `unavailable` → `unavailable`, senão algum `checked` → `checked`, senão `disabled`; feed que lança = `unavailable`). `src/app.ts` monta `[urlhaus?, phishingDb?]` e fecha o timer em `onClose`. Contrato `ThreatFeed` e `analyzer.ts` inalterados. Testes em `tests/unit/adapters/phishing-database.test.ts`, `composite-feed.test.ts` e `tests/api/phishing-feed.test.ts`.
  - ✅ *ANTIGOL-017 (API)* — Feedback anônimo `POST /api/v1/feedback` (`{type:'SCAM_REPORT'|'FALSE_POSITIVE', target:{type,ref}, level, signalIds}`, Zod `.strict()` em `src/api/schemas/feedback.ts`, corpo ≤ 4 KB, rate limit com contador próprio da rota, `Cache-Control: no-store`, 201 `{status:'received'}`; falha do armazenamento → 503 `FEEDBACK_UNAVAILABLE` e log só com `{ code }`). O conteúdo analisado **nunca** é reenviado: o `/analyze` devolve `targetRef` (HMAC-SHA256 hex de 64 caracteres, `src/core/feedback/target-ref.ts`; URL = domínio registrável via `tldts`, mensagem = `sanitizeText` + `normalizeForMatching`). Porta `FeedbackStore` em `src/core/feedback/types.ts` e adapter SQLite (`node:sqlite`, sem dependências) em `src/adapters/sqlite-feedback-store.ts`: tabela `feedbacks` só com tipo, tipo do alvo, ref, nível, IDs de regra e **data sem hora** (sem IP, user-agent, UUID nem conteúdo). Envs `FEEDBACK_HMAC_SECRET` (opcional, ≥ 32 caracteres; vazio = aleatório por processo, `sync: false` no Render) e `FEEDBACK_DB_PATH` (padrão `:memory:`: zera a cada restart no Render Free). Hook de Content-Type JSON compartilhado em `src/api/content-type.ts`. `engines.node` >= 22.13; o `node:sqlite` pode emitir `ExperimentalWarning`. Testes em `tests/api/feedback.test.ts`, `tests/unit/core/target-ref.test.ts` e `tests/unit/adapters/sqlite-feedback-store.test.ts`.
- **Frontend / Mobile:** ✅ *ANTIGOL-007* — **Expo (SDK 58) + Expo Router + NativeWind v4 (Tailwind CSS v3)** em `apps/mobile/` (package.json próprio; testes com **jest-expo**, `npm test` dentro da pasta).
  - Rotas: `apps/mobile/src/app/` · Componentes: `src/components/` · Tipos do contrato da API: `src/types/api.ts` · Cliente HTTP: `src/services/api.ts`.
  - `api.ts`: `EXPO_PUBLIC_API_URL`, timeout de 10s (`AbortController`), `AppError` (`code`, `status`, `details`, `retryAfterSeconds`) com códigos do backend + `TIMEOUT | NETWORK_ERROR | INVALID_RESPONSE`; 429 → `RATE_LIMIT_EXCEEDED` lendo `Retry-After`. Nenhum `console.*` e nenhuma lib de analytics/rastreamento (LGPD).
  - ✅ *ANTIGOL-008* — tela de análise em `src/app/index.tsx`; `analyzeTarget` com detecção automática url/message; testes de tela com RNTL (em `src/__tests__/`, fora de `src/app/` para não virarem rotas).
  - ✅ *ANTIGOL-009* — `RiskCard` em `src/components/RiskCard.tsx` recebe `AnalysisReport` + `analyzedAt?` (ISO, horário local gerado no cliente; fora do contrato da API). Cores por `level` com classes literais (`text-/border-risk-none|attention|high`); seções vazias são omitidas; todo texto vem do relatório da API, nunca do input. Testes em `src/__tests__/RiskCard.test.tsx`.
  - ✅ *ANTIGOL-010* — `src/app/index.tsx` usa estado explícito `idle | loading | success | error`. No 429 com `Retry-After` > 0 o botão fica bloqueado com contagem regressiva (`Tente novamente em N s`, testID `retry-countdown`); sem `Retry-After`, apenas a mensagem. Teste de integração em `src/__tests__/integration.test.tsx` (tela + `api.ts` real com `fetch` simulado: NETWORK_ERROR, TIMEOUT, 429, 200 e LGPD).
  - ✅ *ANTIGOL-011* — PWA sem Service Worker: manifest em `public/manifest.json` (+ ícones 192/512 em `public/icons/`) e `src/app/+html.tsx` (theme-color `#208AEF`, `display: standalone`, `lang pt-BR`; as chaves PWA de `app.json > web` são ignoradas pelo Metro). Modo offline via `expo-network` `useNetworkState`: `isConnected === false` mostra `offline-banner` e desabilita o botão (nenhuma requisição é enviada); `undefined` conta como online. Testes em `src/__tests__/offline.test.tsx` e `pwa.test.ts`.
  - ✅ *ANTIGOL-015* — Deploy da PWA na **Vercel Hobby** ($0, sem cartão) como site estático: `apps/mobile/app.json` com `web.output: "static"` (o modo `server` exigiria adapter) e script `export:web` (`expo export -p web` → `apps/mobile/dist/`, no `.gitignore`). `apps/mobile/vercel.json` (Root Directory = `apps/mobile` no painel; `framework: null`, `buildCommand: npm run export:web`, `outputDirectory: dist`) com rewrite de SPA para `/index.html` e headers: segurança em `/(.*)` (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS), `application/manifest+json` em `/manifest.json` e cache `immutable` em `/_expo/static/`. `EXPO_PUBLIC_API_URL` só no painel (embutida no bundle **no build**; mudar exige redeploy; nunca segredo) e `CORS_ORIGIN` do Render = domínio da Vercel (sem `*`). LGPD: Web Analytics/Speed Insights desligados, sem `@vercel/*` nem chave `env` no `vercel.json`, sem função serverless (conteúdo só no corpo do POST). Guia em `docs/DEPLOY.md` (cold start do Render aparece como timeout de 10s; deploy da Vercel não espera o CI). Teste estático em `tests/infra/vercel.test.ts`.
  - ✅ *ANTIGOL-016 (app)* — Validação local de chave Pix em `src/utils/pix.ts` (`validatePixKey` → `PixKeyCheck { type, status, reasons } | null`; CPF/CNPJ com DV módulo 11 incluindo **CNPJ alfanumérico**, e-mail até 77 caracteres, telefone +55 com DDD, chave aleatória UUID). Alertas amarelos: `SEQUENTIAL_DOCUMENT`, `BRAND_IMPERSONATION` (e-mail grátis citando marca; tokens copiados de `brands.ts` da API) e `FOREIGN_PHONE`. `src/components/PixKeyFeedback.tsx` mostra textos fixos (nunca a chave) e sempre o aviso "Confira o nome e o banco do recebedor". Em `src/app/index.tsx`, se o texto é uma chave Pix (token único), o feedback aparece (também offline) e o botão fica desabilitado: **nenhuma requisição é enviada à API** (LGPD). Testes em `src/utils/__tests__/pix.test.ts` e `src/__tests__/PixKeyFeedback.test.tsx`.
  - ✅ *ANTIGOL-017 (app)* — `RiskCard` aceita `onFeedback?` e `feedbackDisabled?`: seção "Este resultado ajudou?" com "Isso é golpe" (`feedback-scam`) e "Falso positivo" (`feedback-false-positive`, oculto em `NO_KNOWN_INDICATORS`); estados `idle | sending | sent | error` com textos fixos (`feedback-thanks`, `feedback-error`). `sendFeedback` em `src/services/api.ts`; `src/app/index.tsx` monta o corpo com `targetRef`, nível e IDs dos sinais (nunca o texto digitado), desabilita offline e usa `key={analyzedAt}` para zerar o estado a cada análise. Teste de LGPD em `src/__tests__/integration.test.tsx`.
  - O `vitest.config.ts` da raiz restringe o Vitest do backend a `tests/`.
  - ✅ *ANTIGOL-018 (API)* — Métricas anônimas `GET /api/v1/metrics` (sem corpo; `since` só com data, `generatedAt`, `analyses{total,byType}`, `levels`, `categories` com as 11 chaves sempre preenchidas e `feedback{scamReports,falsePositives}`). Contadores **em memória** (zeram no restart) em `src/core/metrics/counter.ts` (`createMetricsCounter`, `RISK_LEVELS`/`SIGNAL_CATEGORIES` verificados por tipo contra `core/types.ts`): só inteiros por enum; a categoria conta uma vez por análise; nenhum conteúdo, `targetRef`, IP, ID de regra ou hora. O `/analyze` chama `metrics.record` em try/catch silencioso (falha de métricas nunca derruba a análise; URL rejeitada não conta). Rota em `src/api/routes/metrics.ts` com cache em closure (`METRICS_CACHE_TTL_MS`, 1000–3600000, padrão 60000; `Cache-Control: public, max-age`), rate limit com contador próprio e, se `FeedbackStore.totals()` (nova na porta) lançar, 200 com feedback zerado e log só `{ code: 'FEEDBACK_UNAVAILABLE' }`. `buildApp` aceita `deps.metrics` e `deps.now`. Testes em `tests/api/metrics.test.ts`, `tests/unit/core/metrics-counter.test.ts` e `tests/unit/adapters/sqlite-feedback-store.test.ts`.
  - ✅ *ANTIGOL-018 (app)* — Tela `/metrics` (`src/app/metrics.tsx`; estados `loading | success | error`, offline mostra `offline-banner` sem requisição, erro com texto fixo e "Tentar novamente", 429 com mensagem própria, botão "Atualizar") e `src/components/MetricsDashboard.tsx` (apresentação pura: cartões de KPI, barras por nível com `bg-risk-high|attention|none` e largura em % via `style`, categorias > 0 em ordem decrescente, estado vazio e rodapé "Dados agregados e anônimos"; sem biblioteca de gráficos). `getMetrics` em `src/services/api.ts`, `MetricsResponse` em `src/types/api.ts` e link "Ver painel de ameaças" (`metrics-link`) em `src/app/index.tsx`. Testes em `src/__tests__/MetricsDashboard.test.tsx` e `metrics-screen.test.tsx`.
- **Banco de Dados Local / Cache:** SQLite (local/dev) ou PostgreSQL (Free tier / Docker local). Em uso: `node:sqlite` para o feedback anônimo (ANTIGOL-017), em memória por padrão.
- **Inteligência de Ameaças (Free/Open):**
  * URLhaus Threat Feed (Integrado - ANTIGOL-005)
  * Phishing.Database — lista pública de domínios de phishing, consulta local em memória (Integrado - ANTIGOL-016)
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
│   │   ├── routes/             # Endpoints (analyze.ts, feedback.ts, health.ts, metrics.ts)
│   │   ├── content-type.ts     # Hook compartilhado: só application/json
│   │   └── errors.ts           # Tratamento padronizado de erros
│   ├── core/                   # Núcleo de Inteligência Antifraude (Regras puras)
│   │   ├── feedback/           # Porta FeedbackStore e targetRef HMAC (types.ts, target-ref.ts)
│   │   └── metrics/            # Contadores anônimos em memória (counter.ts)
│   ├── adapters/               # Adaptadores para serviços externos (URLhaus, Phishing.Database, composite-feed, shared, sqlite-feedback-store)
│   └── utils/                  # Funções utilitárias e mascaramento de dados (LGPD)
└── tests/                      # Bateria de testes automatizados (Vitest)
```

---

## Diretrizes Comportamentais do Agente (Baseado em Karpathy)

- **Think Before Coding:** Antes de implementar tarefas complexas, declare explicitamente suas premissas e aponte se houver ambiguidades. Não decida sozinho em cenários ambíguos.
- **Simplicity First:** Prefira sempre a solução mais simples e direta. Sem abstrações desnecessárias, sem recursos especulativos e sem código complexo quando uma implementação enxuta resolve.
- **Surgical Changes:** Ao editar arquivos existentes, toque apenas no que for estritamente necessário para a tarefa (`ANTIGOL-XXX`). Não altere comentários adjacentes, formatações ou códigos que funcionam e não foram solicitados.
- **Goal-Driven Execution:** Foque em critérios de sucesso claros (ex: escrever testes que reproduzem o comportamento antes de implementar e garantir que o `npm test` passe de forma limpa).