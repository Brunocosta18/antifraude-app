# 🛡️ Antifraude Brasil

Ajuda pessoas a identificar golpes digitais (links suspeitos, Pix falso, engenharia social) **antes** de pagar ou fornecer dados.

O projeto tem duas partes:

| Parte   | Pasta                          | Tecnologia                                  |
| ------- | ------------------------------ | ------------------------------------------- |
| **API** | raiz (`src/`)                  | Node.js 24 + TypeScript + Fastify 5 · Zod · Vitest |
| **App** | [`apps/mobile/`](apps/mobile)  | Expo + Expo Router + NativeWind (Android, iOS e Web/PWA) |

100% open source e custo $0.

---

## 🚀 Como rodar a API

> Pré-requisito: Node.js 22.13 ou superior (recomendado 24 LTS).

```bash
npm install
cp .env.example .env   # opcional: sem .env, valores padrão seguros são usados
npm run dev            # http://127.0.0.1:3000 com recarga automática
```

Teste se está no ar:

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok","service":"antifraude-api","version":"0.1.0",...}
```

---

## 📱 Como rodar o App

Em outro terminal, com a API rodando:

```bash
cd apps/mobile
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL aponta para a API
npm start              # a = Android · i = iOS · w = Web
```

Dicas:

- **Emulador Android:** `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`
- **Aparelho físico:** use o IP da sua máquina na rede (ex.: `http://192.168.0.10:3000`)
- **Navegador (Expo Web):** adicione `http://localhost:8081` ao `CORS_ORIGIN` do `.env` da API
- ⚠️ Tudo em `EXPO_PUBLIC_*` vai dentro do app: **nunca coloque segredos ali**.

Mais detalhes no [README do app](apps/mobile/README.md).

---

## 🧰 Comandos da API

| Comando                | O que faz                                    |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Desenvolvimento com recarga automática       |
| `npm test`             | Roda os testes (Vitest)                      |
| `npm run typecheck`    | Verifica os tipos do TypeScript              |
| `npm run build`        | Compila para `dist/`                         |
| `npm start`            | Executa a versão compilada                   |
| `npm run docker:smoke` | Testa a imagem Docker                        |

Para rodar em container: `docker compose up --build`.

---

## ⚙️ Configuração

Todas as variáveis estão comentadas em [`.env.example`](.env.example). As principais:

| Variável           | Para que serve                                                  |
| ------------------ | --------------------------------------------------------------- |
| `PORT` / `HOST`    | Porta e endereço do servidor (padrão `3000` / `127.0.0.1`)      |
| `CORS_ORIGIN`      | Origens permitidas, separadas por vírgula (`*` só fora de produção) |
| `URLHAUS_AUTH_KEY` | Chave do feed URLhaus (opcional; sem ela, usa só as regras locais) |
| `RATE_LIMIT_MAX`   | Máximo de análises por IP na janela (padrão `30` por minuto)     |

---

## 📚 Documentação

| Documento                                        | Conteúdo                                   |
| ------------------------------------------------ | ------------------------------------------ |
| [`docs/PRODUCT_SCOPE.md`](docs/PRODUCT_SCOPE.md) | Escopo do produto e regras de negócio      |
| [`docs/API.md`](docs/API.md)                     | Endpoints e contrato da API                |
| [`docs/DEPLOY.md`](docs/DEPLOY.md)               | Deploy gratuito: Render (API) + Vercel (App) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)             | Backlog e tarefas (ANTIGOL-XXX)            |
| [`CLAUDE.md`](CLAUDE.md)                         | Diretrizes e regras do projeto             |
