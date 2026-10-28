---
name: antigolpe-architect
description: Arquiteto de Software e Engenheiro Core do Projeto Antigolpe. Use sempre que precisar de orientacao, planejamento de tarefas (ANTIGOL-XXX), criacao de rotas Fastify, componentes Expo/React Native, integracoes de threat feeds ou revisao de conformidade com LGPD e custo $0.
---

# 🛡️ Antigolpe Architect — Skill do Projeto Antifraude

Esta skill rege todas as decisões de arquitetura, desenvolvimento backend (Node.js/Fastify) e frontend (React Native/Expo) do projeto Antigolpe, prevenindo alucinações e garantindo aderência estrita às regras do sistema.

## 📌 Regras Invioláveis do Projeto

1. **Custo Absoluto $0/mês:**
   - Apenas bibliotecas open-source e APIs gratuitas sem cartão de crédito.
   - Graceful degradation obrigatória se qualquer feed ou serviço externo falhar ou atingir limite.

2. **Privacidade e LGPD por Design:**
   - Minimização estrita de PII (Dados Pessoais Identificáveis).
   - Logs de aplicação limpos (nunca logar IP, headers, senhas, mensagens completas ou chaves Pix).
   - Sanitização obrigatória de entradas (`sanitizeText`, `normalizeUrl`) e mascaramento de saídas (`maskSensitiveData`).

3. **Arquitetura Limpa e Modular:**
   - Backend: Node.js 24 LTS + Fastify 5 + TypeScript + Zod + Vitest.
   - Frontend: React Native com Expo (SDK 51+) + Expo Router + NativeWind (Tailwind CSS).
   - Contrato de Erros padronizado via `ApiError`: `{ error: { code, message, details? } }`.
   - Proteção de Abuso: Rate limit ativo em rotas críticas (`POST /api/v1/analyze`) retornando `429 RATE_LIMIT_EXCEEDED`.

4. **Trabalho Incremental:**
   - Todas as tarefas devem seguir o padrão de IDs do roadmap (`ANTIGOL-XXX`).
   - Zero commits automáticos sem confirmação explícita do desenvolvedor.

## 📋 Checklist de Code Review e Validação

- [ ] A solução consome serviços pagos ou exige cartão? (Se sim, rejeite imediatamente).
- [ ] A rota/cliente trata o erro `429 Too Many Requests` exibindo feedback amigável?
- [ ] Há algum vazamento de PII nos logs ou na interface do Expo?
- [ ] Os testes automatizados cobrem cenários de sucesso e degradação?
- [ ] A documentação em `docs/API.md` e `docs/ROADMAP.md` foi atualizada?