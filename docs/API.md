# 🔌 API — Antifraude Brasil

Referência da API HTTP. A análise é feita por regras locais e, opcionalmente, por feeds públicos de ameaças. **Nenhum conteúdo enviado é armazenado.**

| Item | Valor |
| ---- | ----- |
| Base URL local | `http://127.0.0.1:3000` (porta conforme `.env`) |
| Prefixo | `/api/v1` |
| Formato | JSON (`Content-Type: application/json`) |

---

## 📋 Endpoints

| Método | Rota | Para que serve |
| ------ | ---- | -------------- |
| `GET`  | `/health` | Verifica se a API está no ar (sem rate limit) |
| `POST` | [`/api/v1/analyze`](#-post-apiv1analyze) | Analisa uma mensagem ou um link |
| `POST` | [`/api/v1/feedback`](#-post-apiv1feedback) | Recebe "Isso é golpe" / "Falso positivo" |
| `GET`  | [`/api/v1/metrics`](#-get-apiv1metrics) | Métricas anônimas de ameaças |

Os erros seguem um [formato único](#️-erros).

---

## 🔍 POST /api/v1/analyze

Analisa uma mensagem ou um link e devolve um relatório de risco.

### Requisição

```json
{ "type": "url", "content": "bradesc0.com.br" }
```

| Campo | Tipo | Regras |
| ----- | ---- | ------ |
| `type` | `"message"` ou `"url"` | obrigatório |
| `content` | string | obrigatório; espaços nas pontas são removidos; não pode ficar vazio |

**Limites:** mensagem até **5000** caracteres · URL até **2048** · corpo até **32 KB**. Campos extras são rejeitados e nada é cortado em silêncio.

```bash
curl -s -X POST http://127.0.0.1:3000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"type":"url","content":"bradesc0.com.br"}'
```

### Resposta 200

Formato: `{ "type", "targetRef", "report" }`, com `Cache-Control: no-store`. O conteúdo enviado **nunca** volta na resposta.

| Campo | O que é |
| ----- | ------- |
| `type` | O mesmo tipo enviado |
| `targetRef` | Referência opaca do alvo (HMAC-SHA256, 64 caracteres hex). Usada no `/feedback` sem reenviar o conteúdo. Para links, agrupa pelo domínio registrável. |
| `report.level` | Nível de risco (tabela abaixo) |
| `report.label` | Nome do nível em português |
| `report.score` | Pontuação de 0 a 100 |
| `report.signals` | Sinais encontrados (`id`, `category`, `severity`, `weight`, `title`, `explanation`, `advice`) |
| `report.advice` | Conselhos práticos |
| `report.disclaimer` | Aviso de que a análise não é infalível |
| `report.externalCheck` | Resultado da consulta aos feeds externos (tabela abaixo) |

#### Níveis de risco

| `level` | `label` |
| ------- | ------- |
| `HIGH_RISK` | 🔴 Alto Risco |
| `NEEDS_ATTENTION` | 🟡 Requer Atenção |
| `NO_KNOWN_INDICATORS` | ⚪ Nenhum Indicador Conhecido Encontrado |

O app **nunca** afirma que algo é "100% seguro".

#### `externalCheck`

Feeds consultados: **URLhaus** (abuse.ch) e **Phishing.Database**. Com mais de um ativo, vale o pior caso: algum `unavailable` → `unavailable`; senão algum `checked` → `checked`; senão `disabled`.

| Valor | Significado |
| ----- | ----------- |
| `checked` | Consulta feita com sucesso (sem sinais = nada listado) |
| `unavailable` | Falhou ou passou de 2 s; o resultado vem só das regras locais (e dos feeds que responderam) |
| `disabled` | Nenhum feed ligado (sem `URLHAUS_AUTH_KEY` e com `PHISHING_DB_ENABLED=false`) |

#### Sinais dos feeds externos (categoria `threat_intel`)

| ID | Quando aparece | Severidade |
| -- | -------------- | ---------- |
| `TI-URLHAUS-URL` | O link exato está listado no URLhaus | `critical` se ativo, `high` se inativo |
| `TI-URLHAUS-HOST` | O site tem link ativo listado, sem match exato | `high` |
| `TI-PHISHDB-DOMAIN` | O domínio (ou um domínio pai) está na lista Phishing.Database, consultada em memória no servidor | `high` |

`TI-URLHAUS-HOST` e `TI-PHISHDB-DOMAIN` são ignorados para plataformas compartilhadas (ex.: github.com, drive.google.com) e marcas oficiais.

#### Exemplos

<details>
<summary><strong>1. URL de alto risco</strong> (<code>bradesc0.com.br</code>)</summary>

```json
{
  "type": "url",
  "targetRef": "9f2c4e1a7b8d3c5f6a0e1d2b3c4a5f60718293a4b5c6d7e8f9012a3b4c5d6e7f",
  "report": {
    "level": "HIGH_RISK",
    "label": "Alto Risco",
    "score": 50,
    "signals": [
      {
        "id": "DOM-TYPOSQUAT",
        "category": "domain",
        "severity": "critical",
        "weight": 50,
        "title": "Endereço parecido com o de uma marca conhecida",
        "explanation": "O nome do site imita uma marca famosa com letras trocadas, números ou símbolos para enganar.",
        "advice": "Não clique nem digite dados. Acesse a empresa pelo app oficial ou digitando o endereço correto."
      }
    ],
    "advice": [
      "Não clique nem digite dados. Acesse a empresa pelo app oficial ou digitando o endereço correto."
    ],
    "disclaimer": "Esta análise usa sinais conhecidos e não é 100% infalível. Na dúvida, não pague e confirme pelo canal oficial."
  }
}
```

</details>

<details>
<summary><strong>2. URL sem indicadores</strong> (<code>https://www.gov.br/receitafederal</code>)</summary>

```json
{
  "type": "url",
  "targetRef": "9f2c4e1a7b8d3c5f6a0e1d2b3c4a5f60718293a4b5c6d7e8f9012a3b4c5d6e7f",
  "report": {
    "level": "NO_KNOWN_INDICATORS",
    "label": "Nenhum Indicador Conhecido Encontrado",
    "score": 0,
    "signals": [],
    "advice": [
      "Não encontramos sinais conhecidos de golpe, mas continue atento: confirme pedidos de pagamento por outro canal."
    ],
    "disclaimer": "Esta análise usa sinais conhecidos e não é 100% infalível. Na dúvida, não pague e confirme pelo canal oficial."
  }
}
```

</details>

<details>
<summary><strong>3. Mensagem de golpe</strong> (Urubu do Pix)</summary>

Requisição: `{ "type": "message", "content": "Invista R$ 100 e receba R$ 500 em 1 hora! Lucro garantido, Pix na hora." }`

```json
{
  "type": "message",
  "targetRef": "9f2c4e1a7b8d3c5f6a0e1d2b3c4a5f60718293a4b5c6d7e8f9012a3b4c5d6e7f",
  "report": {
    "level": "HIGH_RISK",
    "label": "Alto Risco",
    "score": 50,
    "signals": [
      {
        "id": "MSG-URUBU-PIX",
        "category": "easy_money",
        "severity": "critical",
        "weight": 50,
        "title": "Promessa de dinheiro fácil",
        "explanation": "Promessas de multiplicar dinheiro ou de lucro garantido são típicas do golpe do \"urubu do Pix\" e de pirâmides.",
        "advice": "Não faça Pix para receber \"mais\" depois. Nenhum investimento sério garante lucro."
      }
    ],
    "advice": [
      "Não faça Pix para receber \"mais\" depois. Nenhum investimento sério garante lucro."
    ],
    "disclaimer": "Esta análise usa sinais conhecidos e não é 100% infalível. Na dúvida, não pague e confirme pelo canal oficial."
  }
}
```

</details>

<details>
<summary><strong>4. Mensagem neutra</strong> (<code>Reunião amanhã às 10h na sala 3.</code>)</summary>

```json
{
  "type": "message",
  "targetRef": "9f2c4e1a7b8d3c5f6a0e1d2b3c4a5f60718293a4b5c6d7e8f9012a3b4c5d6e7f",
  "report": {
    "level": "NO_KNOWN_INDICATORS",
    "label": "Nenhum Indicador Conhecido Encontrado",
    "score": 0,
    "signals": [],
    "advice": [
      "Não encontramos sinais conhecidos de golpe, mas continue atento: confirme pedidos de pagamento por outro canal."
    ],
    "disclaimer": "Esta análise usa sinais conhecidos e não é 100% infalível. Na dúvida, não pague e confirme pelo canal oficial."
  }
}
```

</details>

### Limite de requisições

- Cada IP pode fazer **30 requisições por minuto** (configurável por `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW_MS`). Requisições inválidas também contam.
- Toda resposta traz `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` (segundos até zerar).
- Ao exceder: **429** com `Retry-After` (segundos).
- Os contadores ficam só em memória durante a janela.
- Atrás de proxy (ex.: Render), defina `TRUST_PROXY` (nº de saltos, ex.: `1`) para o limite valer por IP real; sem isso, todos dividem o IP do proxy.

### 🔒 Privacidade

- O conteúdo é analisado em memória e descartado. Ele não volta na resposta nem nas mensagens de erro.
- Com o URLhaus ativo, **só o hostname** é enviado ao abuse.ch (nunca caminho, query ou mensagem), em até 3 hostnames por análise. A URL exata é comparada localmente.
- Logs de falha do feed registram só o motivo (`timeout`, `network`, `http_status`, `invalid_response`, `too_large`).
- Logs de requisição registram só id, método, caminho, status e tempo.
- O resultado não é garantia de segurança: golpes novos podem não ser detectados.

---

## 💬 POST /api/v1/feedback

Retorno anônimo sobre um resultado ("Isso é golpe" ou "Falso positivo"). O conteúdo analisado **nunca** é reenviado: o app manda só a `targetRef` recebida no `/analyze`.

### Requisição

```json
{
  "type": "SCAM_REPORT",
  "target": { "type": "url", "ref": "9f2c4e1a7b8d3c5f6a0e1d2b3c4a5f60718293a4b5c6d7e8f9012a3b4c5d6e7f" },
  "level": "HIGH_RISK",
  "signalIds": ["DOM-TYPOSQUAT"]
}
```

| Campo | Tipo | Regras |
| ----- | ---- | ------ |
| `type` | `"SCAM_REPORT"` ou `"FALSE_POSITIVE"` | obrigatório |
| `target.type` | `"message"` ou `"url"` | obrigatório |
| `target.ref` | string | obrigatório; 64 caracteres hex minúsculos (a `targetRef` do `/analyze`) |
| `level` | `HIGH_RISK`, `NEEDS_ATTENTION` ou `NO_KNOWN_INDICATORS` | obrigatório; o nível mostrado ao usuário |
| `signalIds` | string[] | opcional (padrão `[]`); até 20 IDs no padrão `^[A-Z0-9-]{1,40}$` |

**Limites:** corpo até **4 KB**; campos extras são rejeitados. Rate limit com contador próprio (mesmos limites do `/analyze`).

### Resposta 201

```json
{ "status": "received" }
```

Com `Cache-Control: no-store`. Se o armazenamento falhar: **503** `FEEDBACK_UNAVAILABLE`.

### 🔒 Privacidade

- Gravados apenas: tipo do feedback, tipo do alvo, `targetRef`, nível, IDs de regra e a **data** (sem hora, para não cruzar com logs de acesso).
- Sem IP, user-agent, UUID, identificador de dispositivo ou conteúdo. Os logs não registram o corpo.
- SQLite (`node:sqlite`). Com o padrão `FEEDBACK_DB_PATH=:memory:`, os dados zeram a cada restart.
- Sem `FEEDBACK_HMAC_SECRET`, o segredo é aleatório por processo e as refs só agrupam até o restart.

---

## 📊 GET /api/v1/metrics

Métricas anônimas: só contagens inteiras, agregadas em memória desde que o servidor subiu. Não recebe corpo nem parâmetros.

### Resposta 200

```json
{
  "since": "2026-10-29",
  "generatedAt": "2026-10-29T12:00:00.000Z",
  "analyses": { "total": 12, "byType": { "message": 8, "url": 4 } },
  "levels": { "HIGH_RISK": 5, "NEEDS_ATTENTION": 3, "NO_KNOWN_INDICATORS": 4 },
  "categories": { "easy_money": 4, "fake_billing": 0, "urgency": 6, "credential_request": 0, "impersonation": 1, "payment_pressure": 2, "fake_prize": 0, "fake_job": 0, "domain": 3, "url_structure": 1, "threat_intel": 0 },
  "feedback": { "scamReports": 2, "falsePositives": 1 }
}
```

| Campo | O que é |
| ----- | ------- |
| `since` | Data (sem hora) em que a contagem começou |
| `generatedAt` | Quando o corpo foi montado (o cache pode devolvê-lo por até `METRICS_CACHE_TTL_MS`) |
| `analyses` | Total de análises concluídas e divisão por tipo; URLs rejeitadas (`INVALID_URL`) não contam |
| `levels` | Análises por nível de risco |
| `categories` | Análises com ao menos um sinal da categoria (conta uma vez por análise); as 11 chaves sempre aparecem |
| `feedback` | Totais de "Isso é golpe" e "Falso positivo" |

### Cache e erros

- `Cache-Control: public, max-age=<ttl em segundos>` (padrão 60). O servidor guarda o corpo em memória pelo mesmo prazo (`METRICS_CACHE_TTL_MS`, 1000 a 3600000 ms).
- **429** `RATE_LIMIT_EXCEEDED` com contador próprio da rota.
- Se o armazenamento de feedback falhar, a resposta continua **200** com `feedback` zerado.

### 🔒 Privacidade

- Só inteiros por categoria fixa: nenhum conteúdo, `targetRef`, IP, ID de regra ou hora de análise.
- Os contadores ficam em memória e zeram a cada restart (no Render Free, também na hibernação).

---

## ⚠️ Erros

Formato único em todas as rotas:

```json
{ "error": { "code": "...", "message": "...", "details": [] } }
```

As mensagens são fixas em português. `details` (opcional) traz só `field` e `issue`, **nunca** o valor recebido.

| Status | `code` | Quando |
| ------ | ------ | ------ |
| 400 | `MALFORMED_JSON` | O corpo não é JSON válido |
| 404 | `NOT_FOUND` | Rota inexistente (inclui `GET /api/v1/analyze`) |
| 413 | `PAYLOAD_TOO_LARGE` | Corpo acima do limite da rota |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` diferente de JSON |
| 422 | `VALIDATION_ERROR` | Corpo ausente ou inválido, campo faltando, tipo errado, vazio, acima do limite ou campos extras |
| 422 | `INVALID_URL` | Link rejeitado: `EMPTY`, `TOO_LONG`, `INVALID_URL`, `UNSUPPORTED_SCHEME`, `LOCAL_HOSTNAME` ou `PRIVATE_ADDRESS` |
| 429 | `RATE_LIMIT_EXCEEDED` | Limite por IP excedido; veja `Retry-After` |
| 503 | `FEEDBACK_UNAVAILABLE` | Só no `/feedback`: o armazenamento falhou |
| 4xx | `REQUEST_ERROR` | Outro erro de cliente (ex.: `Content-Length` inválido); mantém o status original |
| 500 | `INTERNAL_ERROR` | Erro inesperado, sem detalhes |

<details>
<summary><strong>Exemplos de erro</strong></summary>

422 `VALIDATION_ERROR` (`type` desconhecido):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Os dados enviados são inválidos. Verifique os campos e tente novamente.",
    "details": [{ "field": "type", "issue": "invalid_union" }]
  }
}
```

422 `INVALID_URL` (`http://127.0.0.1`):

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "O link informado não pode ser analisado.",
    "details": [{ "field": "content", "issue": "PRIVATE_ADDRESS" }]
  }
}
```

400 `MALFORMED_JSON`:

```json
{ "error": { "code": "MALFORMED_JSON", "message": "O corpo da requisição não é um JSON válido." } }
```

415 `UNSUPPORTED_MEDIA_TYPE`:

```json
{ "error": { "code": "UNSUPPORTED_MEDIA_TYPE", "message": "Use o tipo de conteúdo application/json." } }
```

429 `RATE_LIMIT_EXCEEDED`:

```json
{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Muitas requisições enviadas. Tente novamente mais tarde." } }
```

503 `FEEDBACK_UNAVAILABLE`:

```json
{ "error": { "code": "FEEDBACK_UNAVAILABLE", "message": "Não foi possível registrar seu retorno agora. Tente novamente mais tarde." } }
```

</details>
