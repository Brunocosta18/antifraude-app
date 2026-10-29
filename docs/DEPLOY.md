# Deploy (API no Render + PWA na Vercel)

## API no Render (plano Free, $0, sem cartão)

A API roda como container Docker (`apps/api/Dockerfile`, contexto = raiz do repositório) descrito pelo Blueprint [`render.yaml`](../render.yaml).

## Pré-requisitos
- Conta gratuita no [Render](https://render.com) (não pede cartão).
- Repositório no GitHub com o CI (ANTIGOL-013) funcionando; o deploy automático só ocorre depois que os checks passam (`autoDeployTrigger: checksPass`).

## Passo a passo
1. No painel do Render: **New** > **Blueprint** e selecione o repositório.
2. Preencha as variáveis marcadas como `sync: false`:
   - `CORS_ORIGIN`: origem(ns) da PWA, separadas por vírgula (ex.: `https://app.exemplo.com.br`). **Não use `*`**: em produção o boot rejeita.
   - `URLHAUS_AUTH_KEY` (opcional): chave gratuita em <https://auth.abuse.ch/>. Vazia = feed desligado e a API segue só com as regras locais (graceful degradation).
   - `FEEDBACK_HMAC_SECRET` (recomendado, ANTIGOL-017): segredo de pelo menos 32 caracteres (ex.: `openssl rand -hex 32`) que assina a referência opaca do feedback. Vazio = aleatório a cada restart, e as refs só agregam até lá.
3. Clique em **Apply**. O Render faz o build da imagem e passa a consultar `/health`.

## Segredos
- Configure segredos **somente** no painel (Environment). Nunca em commit, `.env` versionado, `ARG`/`ENV` do Dockerfile ou logs.
- Se a chave vazar, gere outra em auth.abuse.ch e atualize no painel (rotação).

## Variáveis de ambiente

| Variável | Valor no Render | Faixa válida (`src/config/env.ts`) |
|---|---|---|
| `NODE_ENV` | `production` | `development` \| `test` \| `production` |
| `HOST` | `0.0.0.0` | texto não vazio |
| `PORT` | `3000` (igual ao `EXPOSE`/`HEALTHCHECK` do Dockerfile) | inteiro de 1 a 65535 |
| `LOG_LEVEL` | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` |
| `TRUST_PROXY` | `1` | `true`, `false` ou inteiro de 1 a 10 (padrão `false`) |
| `THREAT_FEED_TIMEOUT_MS` | `2000` | inteiro de 100 a 2000 |
| `PHISHING_DB_ENABLED` | `true` (já no `render.yaml`) | `true` \| `false` (padrão `false`) |
| `PHISHING_DB_REFRESH_MS` | padrão `21600000` (6 h) | inteiro de 3600000 (1 h) a 86400000 (24 h) |
| `RATE_LIMIT_MAX` | `30` | inteiro de 1 a 10000 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | inteiro de 1000 a 3600000 |
| `CORS_ORIGIN` | preencher no painel | lista separada por vírgula; sem `*` em produção |
| `URLHAUS_AUTH_KEY` | preencher no painel (segredo, opcional) | texto; vazio = feed desligado |
| `FEEDBACK_HMAC_SECRET` | preencher no painel (segredo) | 32+ caracteres; vazio = aleatório por processo |
| `FEEDBACK_DB_PATH` | padrão `:memory:` | caminho do SQLite; `:memory:` zera a cada restart |

`TRUST_PROXY=1` faz a API usar o IP real do cliente (entrada do `X-Forwarded-For` anexada pelo proxy do Render) no rate limit por IP. Sem isso, todos os usuários dividiriam o limite do IP do proxy. O valor é um número de saltos: se a validação abaixo falhar, ajuste-o no painel, sem mudar código.

## Limitações do plano Free
- Hiberna após 15 min sem tráfego; a primeira requisição depois disso sofre cold start de ~30 a 60 s.
- 750 horas de instância por mês.
- Feed Phishing.Database (ANTIGOL-016): a lista (~11 MB) é baixada a cada restart e mantida em memória (algumas dezenas de MB a mais, dentro dos 512 MB do Free). Até o download terminar (e se ele falhar) o `externalCheck` fica `unavailable` e a análise segue só com as regras locais.
- Os contadores do rate limit ficam em memória e zeram a cada restart/deploy.
- Feedback anônimo (ANTIGOL-017): o SQLite fica em `:memory:`, então os registros zeram a cada restart/deploy (o Free não tem disco persistente). O `node:sqlite` pode emitir um `ExperimentalWarning` no log de inicialização; é esperado. Exige Node >= 22.13 (a imagem usa Node 24).
- As flags `read_only`, `cap_drop` e `no-new-privileges` do `docker-compose.yml` não existem no Render; o `USER node` do Dockerfile continua valendo.

## Validação pós-deploy
Troque `<servico>` pelo nome do serviço no Render.

```bash
curl -i https://<servico>.onrender.com/health
curl -i -X POST https://<servico>.onrender.com/api/v1/analyze \
  -H 'Content-Type: application/json' \
  -d '{"type":"url","content":"http://example.com"}'
```

1. `/health` responde 200.
2. `POST /api/v1/analyze` responde 200 com `report.level` e `report.externalCheck`.
3. A resposta traz `X-RateLimit-*` e `Strict-Transport-Security`.
4. `TRUST_PROXY`: o `X-RateLimit-Remaining` deve ser independente entre duas redes diferentes (ex.: Wi-Fi e 4G). Se for compartilhado, ajuste o número de saltos.
5. Nos logs do painel não devem aparecer IP, corpo nem query string.

## Rollback
No painel do serviço, abra **Events** (ou **Deploys**) e use **Rollback** para o deploy anterior.

## PWA na Vercel (Hobby, $0)

A interface Web/PWA (`apps/mobile/`) é publicada como site estático (`expo export -p web`, com `web.output: "static"` no `app.json`) servido pela CDN da Vercel, conforme [`apps/mobile/vercel.json`](../apps/mobile/vercel.json). Não há função serverless: o conteúdo analisado vai no corpo do `POST` para a API (nunca na URL) e os logs de borda veem só caminhos estáticos.

### Passo a passo
1. No painel da Vercel (conta Hobby gratuita, sem cartão): **Add New** > **Project** e importe o repositório.
2. Em **Root Directory**, informe `apps/mobile`. Framework: **Other** (o `vercel.json` define instalação, build e saída).
3. Em **Environment Variables** (Production e Preview), crie `EXPO_PUBLIC_API_URL=https://<servico>.onrender.com`.
   - O valor é embutido no bundle **no build**: mudar o valor exige novo deploy.
   - É público: nunca coloque segredo nessa variável.
4. Clique em **Deploy**.

### Ligação com o Render
No painel do Render, defina `CORS_ORIGIN` com o domínio da Vercel (ex.: `https://<projeto>.vercel.app`), sem `*`. Sem isso o navegador bloqueia as chamadas à API.

### LGPD
- Mantenha **Web Analytics** e **Speed Insights** da Vercel **desligados** (não instale `@vercel/analytics` nem `@vercel/speed-insights`).
- O texto/URL analisado vai no corpo do `POST`, nunca na URL; não há função serverless nem runtime logs de servidor.

### Limitações
- O cold start da API no Render Free aparece como timeout de 10 s na primeira chamada após a hibernação; tentar de novo resolve.
- O deploy da Vercel **não espera o CI** do GitHub Actions.

### Validação pós-deploy
Troque `<projeto>` pelo nome do projeto na Vercel.

```bash
curl -I https://<projeto>.vercel.app/
curl -I https://<projeto>.vercel.app/manifest.json
```

1. `/` responde 200 com `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy: no-referrer` e `Strict-Transport-Security`.
2. `/manifest.json` responde com `Content-Type: application/manifest+json`.
3. A PWA pode ser instalada (opção "Instalar app" no navegador).
4. Uma análise real conclui sem erro de CORS.
5. Abrir `/rota-inexistente` carrega o app (fallback de SPA).

### Rollback
Em **Deployments**, escolha o deploy anterior e use **Promote to Production**.
