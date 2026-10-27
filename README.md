# 🛡️ Antifraude Brasil — API

Backend do aplicativo que ajuda pessoas a identificar golpes digitais (links suspeitos, Pix falso, engenharia social) **antes** de pagar ou fornecer dados. Escopo do produto em [`docs/PRODUCT_SCOPE.md`](docs/PRODUCT_SCOPE.md); diretrizes do projeto em [`CLAUDE.md`](CLAUDE.md).

**Stack:** Node.js 24 + TypeScript + Fastify 5 · Zod · Vitest — 100% open source, custo $0.

## Pré-requisitos
- Node.js 22 ou superior (recomendado 24 LTS)

## Como rodar
```bash
npm install
cp .env.example .env      # opcional: sem .env os padrões seguros são usados
npm run dev               # servidor com recarga automática em http://127.0.0.1:3000
```

Verifique a saúde do serviço:
```bash
curl http://127.0.0.1:3000/health
# {"status":"ok","service":"antifraude-api","version":"0.1.0","uptimeSeconds":3,"timestamp":"..."}
```

## Scripts
| Comando | Descrição |
|---|---|
| `npm run dev` | Desenvolvimento com recarga automática (tsx) |
| `npm test` | Executa os testes (Vitest) |
| `npm run typecheck` | Verificação de tipos |
| `npm run build` | Compila para `dist/` |
| `npm start` | Executa a versão compilada |

## Variáveis de ambiente
Veja [`.env.example`](.env.example). Destaque: `CORS_ORIGIN` aceita uma lista separada por vírgulas; `*` só é permitido fora de produção.
