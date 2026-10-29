# Deploy da API no Render (plano Free, $0, sem cartão)

A API roda como container Docker (`apps/api/Dockerfile`, contexto = raiz do repositório) descrito pelo Blueprint [`render.yaml`](../render.yaml).

## Pré-requisitos
- Conta gratuita no [Render](https://render.com) (não pede cartão).
- Repositório no GitHub com o CI (ANTIGOL-013) funcionando; o deploy automático só ocorre depois que os checks passam (`autoDeployTrigger: checksPass`).

## Passo a passo
1. No painel do Render: **New** > **Blueprint** e selecione o repositório.
2. Preencha as variáveis marcadas como `sync: false`:
   - `CORS_ORIGIN`: origem(ns) da PWA, separadas por vírgula (ex.: `https://app.exemplo.com.br`). **Não use `*`**: em produção o boot rejeita.
   - `URLHAUS_AUTH_KEY` (opcional): chave gratuita em <https://auth.abuse.ch/>. Vazia = feed desligado e a API segue só com as regras locais (graceful degradation).
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
| `RATE_LIMIT_MAX` | `30` | inteiro de 1 a 10000 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | inteiro de 1000 a 3600000 |
| `CORS_ORIGIN` | preencher no painel | lista separada por vírgula; sem `*` em produção |
| `URLHAUS_AUTH_KEY` | preencher no painel (segredo, opcional) | texto; vazio = feed desligado |

`TRUST_PROXY=1` faz a API usar o IP real do cliente (entrada do `X-Forwarded-For` anexada pelo proxy do Render) no rate limit por IP. Sem isso, todos os usuários dividiriam o limite do IP do proxy. O valor é um número de saltos: se a validação abaixo falhar, ajuste-o no painel, sem mudar código.

## Limitações do plano Free
- Hiberna após 15 min sem tráfego; a primeira requisição depois disso sofre cold start de ~30 a 60 s.
- 750 horas de instância por mês.
- Os contadores do rate limit ficam em memória e zeram a cada restart/deploy.
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
