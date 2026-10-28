# Roadmap

Backlog por tarefa (`ANTIGOL-XXX`). Atualize o status ao entregar.

# 🗺️ Antifraude API — Roadmap do Projeto

## 🎯 Visão Geral
Sistema de detecção de fraudes, golpes e engenharia social focado no mercado brasileiro, orientado à privacidade (LGPD), com arquitetura limpa, tempo de resposta baixo e custo zero de infraestrutura ($0/mês).

---

## 🟢 Fase 1: Backend Core & Inteligência Local (Concluído)
- [x] **ANTIGOL-001**: Estrutura base da API com Fastify, TypeScript, Zod e Clean/Hexagonal Architecture.
- [x] **ANTIGOL-002**: Validação estrita de entrada e sanitização para prevenção de vazamento de PII.
- [x] **ANTIGOL-003**: Motor de análise local determinístico (Regex/Heurísticas para Golpes do PIX, Phishing e Typosquatting).
- [x] **ANTIGOL-004**: Endpoint `POST /api/v1/analyze` padronizado com níveis de risco (`NO_KNOWN_INDICATORS`, `SUSPICIOUS`, `HIGH_RISK`).

## 🟢 Fase 2: Feeds de Ameaças & Endurecimento de Segurança (Concluído)
- [x] **ANTIGOL-005**: Integração com Threat Feed externo (URLhaus) com timeout rigoroso (2s) e Graceful Degradation.
- [x] **ANTIGOL-006**: Proteção de API via `@fastify/rate-limit` (30 req/min por IP configurável via `.env`) e resposta HTTP 429 padronizada.

---

## 🟡 Fase 3: Interface do Usuário — Frontend / Mobile App (Próximo Passo)
- [x] **ANTIGOL-007**: Setup da aplicação mobile/web com **Expo + Expo Router + NativeWind (Tailwind CSS v3)** em `apps/mobile/`, com cliente de API (`timeout`, `AppError`, `429`).
- [x] **ANTIGOL-008**: Construção da tela principal de análise (input para colar mensagens/links suspeitos e botão direto de verificação).
- [x] **ANTIGOL-009**: Tela de resultados intuitiva (card visual com nível de risco em verde/amarelo/vermelho, lista de sinais e conselhos práticos).
- [x] **ANTIGOL-010**: Integração do cliente com a API backend, tratando estado de carregamento, erros de rede e limite de requisições (`429`).
- [x] **ANTIGOL-011**: Suporte a PWA / Instalação no celular e modo offline amigável.

---

## 🔵 Fase 4: Infraestrutura, CI/CD & Deploy ($0/mês)
- [x] **ANTIGOL-012**: Containerização com `Dockerfile` multi-stage otimizado e `docker-compose.yml`.
- [ ] **ANTIGOL-013**: Configuração de esteira de CI/CD via **GitHub Actions** (run tests, typecheck e linter automatizados a cada PR/push).
- [ ] **ANTIGOL-014**: Deploy da API em plataforma de hospedagem gratuita (Render / Fly.io) com variáveis de ambiente configuradas.
- [ ] **ANTIGOL-015**: Deploy da interface Web/PWA na Vercel ou Netlify (Custo $0).

---

## 🟣 Fase 5: Evolução da Inteligência & Funcionalidades Avançadas (Futuro)
- [ ] **ANTIGOL-016**: Integração de novos feeds abertos ou validação avançada de chaves PIX/Bancos.
- [ ] **ANTIGOL-017**: Mecanismo de feedback do usuário ("Isso é um golpe?" / "Falso positivo") focado em privacidade.
- [ ] **ANTIGOL-018**: Painel/Dashboard de métricas anônimas de ameaças detectadas no Brasil.
