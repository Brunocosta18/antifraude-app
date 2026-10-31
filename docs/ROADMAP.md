# 🗺️ Roadmap — Antifraude Brasil

Backlog do projeto dividido em tarefas `ANTIGOL-XXX`. Atualize o status ao entregar cada uma.

**Visão:** detectar golpes, fraudes e engenharia social no Brasil, com privacidade (LGPD), arquitetura limpa, resposta rápida e custo $0/mês.

---

## 📊 Resumo

| Fase | Tema                                   | Tarefas      | Status        |
| ---- | -------------------------------------- | ------------ | ------------- |
| 1    | Backend core e inteligência local      | 001 – 004    | ✅ Concluída |
| 2    | Feeds de ameaças e segurança           | 005 – 006    | ✅ Concluída |
| 3    | Interface (app mobile/web)             | 007 – 011    | ✅ Concluída |
| 4    | Infraestrutura, CI/CD e deploy         | 012 – 015    | ✅ Concluída |
| 5    | Inteligência e funcionalidades avançadas | 016 – 018  | ✅ Concluída |

---

## 🧠 Fase 1 — Backend core e inteligência local

- [x] **ANTIGOL-001** — Estrutura base da API: Fastify, TypeScript, Zod e arquitetura limpa/hexagonal.
- [x] **ANTIGOL-002** — Validação estrita e sanitização da entrada, sem vazamento de dados pessoais.
- [x] **ANTIGOL-003** — Motor de análise local (regex e heurísticas para golpes do Pix, phishing e typosquatting).
- [x] **ANTIGOL-004** — Endpoint `POST /api/v1/analyze` com níveis de risco (`HIGH_RISK`, `NEEDS_ATTENTION`, `NO_KNOWN_INDICATORS`).

## 🛡️ Fase 2 — Feeds de ameaças e segurança

- [x] **ANTIGOL-005** — Feed externo URLhaus, timeout de 2 s e fallback para as regras locais.
- [x] **ANTIGOL-006** — Rate limit por IP (`@fastify/rate-limit`, 30 req/min configurável) com resposta 429 padronizada.

## 📱 Fase 3 — Interface (app mobile/web)

- [x] **ANTIGOL-007** — Setup do app em `apps/mobile/` (Expo + Expo Router + NativeWind) e cliente da API (timeout, `AppError`, 429).
- [x] **ANTIGOL-008** — Tela principal: campo para colar mensagem/link e botão de verificar.
- [x] **ANTIGOL-009** — Card de resultado com cor por nível de risco, sinais e conselhos.
- [x] **ANTIGOL-010** — Estados de carregamento, erros de rede e limite de requisições (429).
- [x] **ANTIGOL-011** — PWA (instalável no celular) e modo offline.

## 🚀 Fase 4 — Infraestrutura, CI/CD e deploy ($0/mês)

- [x] **ANTIGOL-012** — `Dockerfile` multi-stage e `docker-compose.yml`.
- [x] **ANTIGOL-013** — CI no GitHub Actions: testes, typecheck e smoke do Docker a cada push/PR.
- [x] **ANTIGOL-014** — Deploy da API no **Render Free** (`render.yaml`) com `TRUST_PROXY` para o rate limit usar o IP real.
- [x] **ANTIGOL-015** — Deploy da PWA na **Vercel Hobby** (export estático), com `EXPO_PUBLIC_API_URL` no build e `CORS_ORIGIN` no Render.

## 🔬 Fase 5 — Inteligência e funcionalidades avançadas

- [x] **ANTIGOL-016** — Feed **Phishing.Database** consultado em memória no servidor (`TI-PHISHDB-DOMAIN`, combinado com o URLhaus) e **validação local de chave Pix** no app (a chave nunca vai para a API).
- [x] **ANTIGOL-017** — Feedback anônimo "Isso é golpe" / "Falso positivo" (`POST /api/v1/feedback`): só uma referência opaca (`targetRef`, HMAC) em SQLite, sem conteúdo, IP nem identificador de dispositivo.
- [x] **ANTIGOL-018** — Painel de métricas anônimas: contadores em memória, `GET /api/v1/metrics` com cache e tela `/metrics` no app (sem biblioteca de gráficos).

---

📚 Detalhes de cada endpoint em [`API.md`](API.md) · deploy em [`DEPLOY.md`](DEPLOY.md).
