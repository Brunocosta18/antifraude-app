# Roadmap

Backlog por tarefa (`ANTIGOL-XXX`). Atualize o status ao entregar.

## Entregues

- **ANTIGOL-001** — Backend base: Node.js + TypeScript + Fastify, configuração validada (Zod), logger com redação (LGPD), testes com Vitest.
- **ANTIGOL-002** — Entrada sempre sanitizada: `normalizeUrl` (allowlist http/https, anti-SSRF), `sanitizeText`, mascaramento de dados em logs.
- **ANTIGOL-003** — Motor de análise local: regras de mensagem, heurísticas de domínio e Risk Scorer.
- **ANTIGOL-004** — `POST /api/v1/analyze` com contrato documentado em `docs/API.md`.

## Em andamento

- **ANTIGOL-005** — Threat feed URLhaus com graceful degradation.
  - Critérios de aceite:
    - Só o hostname é enviado ao abuse.ch (no máximo 3 hostnames distintos por análise); caminho, query e mensagem nunca saem do servidor.
    - Prazo total da consulta externa ≤ 2s; falha, timeout ou ausência de `URLHAUS_AUTH_KEY` mantêm a análise local.
    - `report.externalCheck` informa `checked`, `unavailable` ou `disabled`.
    - Logs nunca contêm hostname, URL, chave nem corpo de resposta.
    - Testes sem rede real (`fetchFn` falso); `npm run typecheck` e `npm test` verdes.
