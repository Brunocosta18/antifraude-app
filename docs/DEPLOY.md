# 🌐 Deploy — Render (API) + Vercel (App)

Como publicar o projeto de graça, sem cartão de crédito.

| Parte | Onde | Plano | Como |
| ----- | ---- | ----- | ---- |
| **API** | [Render](https://render.com) | Free | Container Docker via Blueprint [`render.yaml`](../render.yaml) |
| **App (PWA)** | [Vercel](https://vercel.com) | Hobby | Site estático via [`apps/mobile/vercel.json`](../apps/mobile/vercel.json) |

> Ordem recomendada: publique a **API** primeiro, depois o **App**, e por fim volte ao Render para preencher o `CORS_ORIGIN`.

---

# 🖥️ Parte 1 — API no Render

A API roda como container (`apps/api/Dockerfile`, contexto = raiz do repositório).

## ✅ Pré-requisitos

- Conta gratuita no Render.
- Repositório no GitHub com o CI (ANTIGOL-013) passando. O deploy automático só acontece **depois** que os checks passam (`autoDeployTrigger: checksPass`).

## 🚀 Passo a passo

1. No painel do Render: **New** > **Blueprint** e escolha o repositório.
2. Preencha as variáveis marcadas como `sync: false`:

   | Variável | O que colocar |
   | -------- | ------------- |
   | `CORS_ORIGIN` | Domínio(s) da PWA, separados por vírgula (ex.: `https://app.exemplo.com.br`). **Não use `*`**: em produção a API não sobe. |
   | `URLHAUS_AUTH_KEY` | *(opcional)* Chave gratuita em <https://auth.abuse.ch/>. Vazia = feed desligado; a API usa só as regras locais. |
   | `FEEDBACK_HMAC_SECRET` | *(recomendado)* Segredo com 32+ caracteres (ex.: `openssl rand -hex 32`). Vazio = aleatório a cada restart. |

3. Clique em **Apply**. O Render faz o build e passa a consultar `/health`.

## 🔑 Segredos

- Configure segredos **só no painel** (Environment). Nunca em commit, `.env` versionado, `ARG`/`ENV` do Dockerfile ou logs.
- Se uma chave vazar, gere outra (ex.: em auth.abuse.ch) e troque no painel.

## ⚙️ Variáveis de ambiente

| Variável | Valor no Render | Valores aceitos (`src/config/env.ts`) |
| -------- | --------------- | ------------------------------------- |
| `NODE_ENV` | `production` | `development` \| `test` \| `production` |
| `HOST` | `0.0.0.0` | texto não vazio |
| `PORT` | `3000` (igual ao `EXPOSE`/`HEALTHCHECK` do Dockerfile) | 1 a 65535 |
| `LOG_LEVEL` | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` |
| `TRUST_PROXY` | `1` | `true`, `false` ou 1 a 10 (padrão `false`) |
| `THREAT_FEED_TIMEOUT_MS` | `2000` | 100 a 2000 |
| `PHISHING_DB_ENABLED` | `true` (já no `render.yaml`) | `true` \| `false` (padrão `false`) |
| `PHISHING_DB_REFRESH_MS` | padrão `21600000` (6 h) | 3600000 (1 h) a 86400000 (24 h) |
| `RATE_LIMIT_MAX` | `30` | 1 a 10000 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 1000 a 3600000 |
| `METRICS_CACHE_TTL_MS` | `60000` | 1000 a 3600000 |
| `CORS_ORIGIN` | preencher no painel | lista separada por vírgula; sem `*` em produção |
| `URLHAUS_AUTH_KEY` | preencher no painel *(segredo, opcional)* | texto; vazio = feed desligado |
| `FEEDBACK_HMAC_SECRET` | preencher no painel *(segredo)* | 32+ caracteres; vazio = aleatório por processo |
| `FEEDBACK_DB_PATH` | padrão `:memory:` | caminho do SQLite; `:memory:` zera a cada restart |

> **Por que `TRUST_PROXY=1`?** Faz o rate limit usar o IP real do cliente (vindo do `X-Forwarded-For` do proxy do Render). Sem isso, todos os usuários dividiriam o limite do IP do proxy. O valor é o número de saltos: se a validação falhar, ajuste no painel, sem mudar código.

## ⚠️ Limitações do plano Free

| Tema | O que acontece |
| ---- | -------------- |
| Hibernação | Dorme após 15 min sem tráfego; a primeira requisição depois leva ~30 a 60 s (cold start). |
| Horas | 750 horas de instância por mês. |
| Phishing.Database | A lista (~11 MB) é baixada a cada restart e fica em memória (algumas dezenas de MB, dentro dos 512 MB). Até terminar (ou se falhar), `externalCheck` fica `unavailable` e valem só as regras locais. |
| Rate limit | Contadores em memória: zeram a cada restart/deploy. |
| Feedback | SQLite em `:memory:` (o Free não tem disco): zera a cada restart/deploy. Um `ExperimentalWarning` do `node:sqlite` no log é esperado. Exige Node ≥ 22.13 (a imagem usa Node 24). |
| Docker | `read_only`, `cap_drop` e `no-new-privileges` do `docker-compose.yml` não existem no Render; o `USER node` do Dockerfile continua valendo. |

## 🔍 Validação pós-deploy

Troque `<servico>` pelo nome do serviço no Render:

```bash
curl -i https://<servico>.onrender.com/health
curl -i -X POST https://<servico>.onrender.com/api/v1/analyze \
  -H 'Content-Type: application/json' \
  -d '{"type":"url","content":"http://example.com"}'
```

- [ ] `/health` responde **200**.
- [ ] `POST /api/v1/analyze` responde **200** com `report.level` e `report.externalCheck`.
- [ ] A resposta traz `X-RateLimit-*` e `Strict-Transport-Security`.
- [ ] `X-RateLimit-Remaining` é independente entre duas redes (ex.: Wi-Fi e 4G). Se for compartilhado, ajuste `TRUST_PROXY`.
- [ ] Os logs do painel **não** mostram IP, corpo nem query string.

## ↩️ Rollback

No painel do serviço: **Events** (ou **Deploys**) > **Rollback** para o deploy anterior.

---

# 📱 Parte 2 — App (PWA) na Vercel

O app (`apps/mobile/`) vira um site estático (`expo export -p web`, com `web.output: "static"` no `app.json`) servido pela CDN da Vercel. Não há função serverless: o conteúdo analisado vai no corpo do `POST` para a API, nunca na URL.

## 🚀 Passo a passo

1. Na Vercel (conta Hobby, sem cartão): **Add New** > **Project** e importe o repositório.
2. Em **Root Directory**, coloque `apps/mobile`. Framework: **Other** (o `vercel.json` define instalação, build e saída).
3. Em **Environment Variables** (Production e Preview), crie:

   ```text
   EXPO_PUBLIC_API_URL=https://<servico>.onrender.com
   ```

   - O valor entra no app **no build**: se mudar, faça um novo deploy.
   - É público: **nunca** coloque segredo aqui.

4. Clique em **Deploy**.

## 🔗 Ligar com o Render

No painel do Render, defina `CORS_ORIGIN` com o domínio da Vercel (ex.: `https://<projeto>.vercel.app`), sem `*`. Sem isso, o navegador bloqueia as chamadas à API.

## 🔒 LGPD

- Deixe **Web Analytics** e **Speed Insights** da Vercel **desligados** (não instale `@vercel/analytics` nem `@vercel/speed-insights`).
- Não há função serverless nem logs de servidor com o conteúdo analisado.

## ⚠️ Limitações

- O cold start do Render Free aparece como **timeout de 10 s** na primeira chamada após a hibernação. Tentar de novo resolve.
- O deploy da Vercel **não espera o CI** do GitHub Actions.

## 🔍 Validação pós-deploy

Troque `<projeto>` pelo nome do projeto na Vercel:

```bash
curl -I https://<projeto>.vercel.app/
curl -I https://<projeto>.vercel.app/manifest.json
```

- [ ] `/` responde **200** com `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy: no-referrer` e `Strict-Transport-Security`.
- [ ] `/manifest.json` responde com `Content-Type: application/manifest+json`.
- [ ] O navegador oferece "Instalar app".
- [ ] Uma análise real funciona sem erro de CORS.
- [ ] `/rota-inexistente` carrega o app (fallback de SPA).

## ↩️ Rollback

Em **Deployments**, escolha o deploy anterior > **Promote to Production**.
