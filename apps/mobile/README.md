# 📱 Antigolpe — App (Mobile + Web/PWA)

Aplicativo do projeto Antigolpe: o usuário cola uma mensagem, um link ou uma chave Pix e recebe uma avaliação de risco **antes** de pagar ou fornecer dados.

Feito com **Expo (SDK 58)**, **Expo Router** e **NativeWind v4** (Tailwind CSS v3). Roda no Android, iOS e navegador (PWA).

---

## 🚀 Como rodar

> Pré-requisito: Node.js 24 e a API rodando (veja o `README.md` da raiz).

1. **Instale as dependências** (dentro de `apps/mobile/`):

   ```bash
   npm install
   ```

2. **Configure a URL da API** copiando o exemplo:

   ```bash
   cp .env.example .env
   ```

   | Onde o app roda     | Valor de `EXPO_PUBLIC_API_URL`               |
   | ------------------- | -------------------------------------------- |
   | Navegador / iOS sim | `http://127.0.0.1:3000`                      |
   | Emulador Android    | `http://10.0.2.2:3000`                       |
   | Aparelho físico     | IP da máquina na rede (ex.: `http://192.168.0.10:3000`) |

   ⚠️ Tudo que começa com `EXPO_PUBLIC_` vai dentro do app. **Nunca coloque segredos aqui.**

3. **Inicie o app:**

   ```bash
   npm start        # menu do Expo (escolha a plataforma)
   npm run web      # direto no navegador
   npm run android  # emulador Android
   npm run ios      # simulador iOS
   ```

---

## 🧰 Comandos úteis

| Comando              | O que faz                                          |
| -------------------- | -------------------------------------------------- |
| `npm test`           | Roda os testes (jest-expo + Testing Library)       |
| `npm run typecheck`  | Verifica os tipos do TypeScript                    |
| `npm run lint`       | Analisa o código com ESLint                        |
| `npm run export:web` | Gera o site estático da PWA em `dist/`             |

---

## 📁 Estrutura

```text
apps/mobile/
├── src/
│   ├── app/            # Telas (rotas por arquivo — Expo Router)
│   │   ├── index.tsx   #   Tela de análise
│   │   ├── metrics.tsx #   Painel de ameaças (/metrics)
│   │   ├── _layout.tsx #   Layout comum
│   │   └── +html.tsx   #   HTML da versão web (PWA)
│   ├── components/     # RiskCard, PixKeyFeedback, MetricsDashboard
│   ├── services/       # api.ts — cliente HTTP da API
│   ├── types/          # api.ts — tipos do contrato da API
│   ├── utils/          # pix.ts — validação local de chave Pix
│   └── __tests__/      # Testes das telas (fora de app/ para não virarem rotas)
├── public/             # manifest.json e ícones da PWA
├── app.json            # Configuração do Expo
└── vercel.json         # Deploy da PWA na Vercel
```

---

## ✨ Funcionalidades

- **Análise de mensagem ou link** — detecta automaticamente o tipo e mostra o resultado no `RiskCard`.
- **Chave Pix** — validada **só no aparelho**; nada é enviado à API.
- **Feedback** — botões "Isso é golpe" / "Falso positivo" (envia só uma referência anônima, nunca o texto).
- **Painel de ameaças** — métricas agregadas e anônimas em `/metrics`.
- **Modo offline** — sem internet, mostra um aviso e não envia requisições.
- **Limite de uso** — se a API limitar (429), o botão mostra uma contagem regressiva.

---

## 🔒 Privacidade (LGPD)

- Nenhum `console.*` e nenhuma biblioteca de analytics ou rastreamento.
- O texto digitado nunca é salvo nem reenviado.
- O app nunca diz que algo é "100% seguro".

---

## 🌐 Deploy

A PWA é publicada na **Vercel** (plano gratuito) como site estático. O passo a passo está em [`docs/DEPLOY.md`](../../docs/DEPLOY.md).

---

## 📚 Saiba mais

- [Documentação do Expo](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [NativeWind](https://www.nativewind.dev/)
