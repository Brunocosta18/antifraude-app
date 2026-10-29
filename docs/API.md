# API do Antifraude

Referência da API HTTP (ANTIGOL-004). A análise é local e determinística, somada (opcionalmente) a uma consulta ao URLhaus (ANTIGOL-005); nenhum conteúdo enviado é armazenado.

- **Base URL local:** `http://127.0.0.1:3000` (porta conforme `.env`)
- **Prefixo da API:** `/api/v1`
- **Formato:** JSON (`Content-Type: application/json`)

## POST /api/v1/analyze

Analisa uma mensagem ou um link e devolve um relatório de risco.

### Request

```json
{ "type": "url", "content": "bradesc0.com.br" }
```

| Campo | Tipo | Regras |
|---|---|---|
| `type` | `"message"` ou `"url"` | obrigatório |
| `content` | string | obrigatório; espaços nas pontas são removidos; não pode ficar vazio |

Limites: mensagem até **5000** caracteres, URL até **2048** caracteres, corpo até **32 KB**. Campos extras são rejeitados. Nada é truncado em silêncio.

### Response 200

`{ "type", "report" }`. O `report` traz `level`, `label`, `score` (0 a 100), `signals`, `advice`, `disclaimer` e `externalCheck`. O conteúdo enviado **nunca** volta na resposta. A resposta usa `Cache-Control: no-store`.

`externalCheck` informa a consulta à fonte externa de ameaças (URLhaus, abuse.ch, e Phishing.Database). Com mais de um feed ativo, o valor é o pior caso: qualquer feed `unavailable` → `unavailable`; senão algum `checked` → `checked`; senão `disabled`:

| Valor | Significado |
|---|---|
| `checked` | consultada com sucesso (sem sinais = nada listado) |
| `unavailable` | falhou ou passou de 2 s; o resultado vem só das regras locais (e das consultas que deram certo) |
| `disabled` | nenhum feed ligado (sem `URLHAUS_AUTH_KEY` e com `PHISHING_DB_ENABLED=false`); análise apenas local |

Sinais da fonte externa (categoria `threat_intel`):

| ID | Quando | Severidade |
|---|---|---|
| `TI-URLHAUS-URL` | o link exato está listado no URLhaus | `critical` se ativo, `high` se inativo |
| `TI-URLHAUS-HOST` | o site tem link ativo listado, sem match exato (ignorado para plataformas compartilhadas como github.com ou drive.google.com e para marcas oficiais) | `high` |
| `TI-PHISHDB-DOMAIN` | o domínio (ou um domínio pai) consta na lista Phishing.Database, consultada em memória no servidor (ignorado para plataformas compartilhadas e marcas oficiais) | `high` |

Níveis: `HIGH_RISK` (Alto Risco), `NEEDS_ATTENTION` (Requer Atenção), `NO_KNOWN_INDICATORS` (Nenhum Indicador Conhecido Encontrado). O app nunca afirma que algo é "100% seguro".

#### Exemplo 1: URL de alto risco

```json
{
  "type": "url",
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

#### Exemplo 2: URL sem indicadores conhecidos (`https://www.gov.br/receitafederal`)

```json
{
  "type": "url",
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

#### Exemplo 3: mensagem de golpe (Urubu do Pix)

Request: `{ "type": "message", "content": "Invista R$ 100 e receba R$ 500 em 1 hora! Lucro garantido, Pix na hora." }`

```json
{
  "type": "message",
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

#### Exemplo 4: mensagem neutra (`Reunião amanhã às 10h na sala 3.`)

```json
{
  "type": "message",
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

### Erros

Formato único: `{ "error": { "code", "message", "details"? } }`. As mensagens são fixas em PT-BR e `details` traz apenas `field` e `issue`, nunca o valor recebido.

| Status | `code` | Quando |
|---|---|---|
| 400 | `MALFORMED_JSON` | corpo não é JSON válido |
| 413 | `PAYLOAD_TOO_LARGE` | corpo maior que 32 KB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` diferente de JSON |
| 422 | `VALIDATION_ERROR` | corpo ausente ou não-objeto, `type` desconhecido, `content` ausente, não-string, vazio, acima do limite, ou campos extras |
| 422 | `INVALID_URL` | link rejeitado: `EMPTY`, `TOO_LONG`, `INVALID_URL`, `UNSUPPORTED_SCHEME`, `LOCAL_HOSTNAME` ou `PRIVATE_ADDRESS` |
| 429 | `RATE_LIMIT_EXCEEDED` | limite de requisições por IP excedido; veja `Retry-After` |
| 404 | `NOT_FOUND` | rota inexistente (inclui `GET /api/v1/analyze`) |
| 4xx | `REQUEST_ERROR` | outro erro de cliente detectado pelo servidor (ex.: `Content-Length` inválido); o status original é mantido |
| 500 | `INTERNAL_ERROR` | erro inesperado, sem detalhes |

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

### Limite de requisições

Cada IP pode fazer **30 requisições por minuto** em `POST /api/v1/analyze` (configurável por `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW_MS`). Requisições inválidas também contam. `/health` não é limitado. Os contadores ficam só na memória do servidor durante a janela. Atrás de proxy reverso (ex.: Render), defina `TRUST_PROXY` (nº de saltos, ex.: `1`) para o limite valer por IP real do cliente; sem isso todos compartilham o IP do proxy.

Toda resposta desta rota traz `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` (segundos até zerar). Ao exceder, a resposta é 429 com `Retry-After` (segundos).

### Exemplo com curl

```bash
curl -s -X POST http://127.0.0.1:3000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"type":"url","content":"bradesc0.com.br"}'
```

### Privacidade

- Nada é armazenado: o conteúdo é analisado em memória e descartado.
- Com o URLhaus ativo, **somente o hostname** (nunca o caminho, a query ou a mensagem) é enviado ao abuse.ch, em até 3 hostnames distintos por análise. A URL exata é comparada localmente. Os logs de falha registram apenas o motivo (`timeout`, `network`, `http_status`, `invalid_response`, `too_large`).
- O conteúdo enviado não volta na resposta, nem em mensagens de erro; os logs registram apenas id, método, caminho, status e tempo.
- O resultado não é garantia de segurança: a análise usa sinais conhecidos e pode não detectar golpes novos.
