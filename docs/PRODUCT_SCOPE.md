# 📄 Escopo do Produto — Antifraude Brasil

O que o produto resolve, o que entra no MVP e o que fica para depois.

---

## 🎯 Problema e proposta

Muitas pessoas no Brasil caem em golpes por WhatsApp, SMS, e-mail e links falsos.

O app ajuda a identificar **sinais de risco** de forma rápida, didática e acessível, **antes** de pagar ou fornecer dados pessoais.

---

## 🚀 MVP (versão 1.0)

A primeira versão faz **análise sob demanda**: o próprio usuário cola o conteúdo que quer verificar.

### 1. Analisador de links

O usuário cola um link suspeito e o sistema verifica:

- padrões do domínio: HTTPS, marcas famosas com letras trocadas (ex.: `banc0.com`), domínios recém-registrados e TLDs de alto risco (`.xyz`, `.top`);
- bases públicas e gratuitas de ameaças.

### 2. Analisador de mensagens (engenharia social)

O usuário cola uma mensagem recebida e regras locais procuram:

| Padrão                        | Exemplo                                  |
| ----------------------------- | ---------------------------------------- |
| Urgência artificial           | "Sua conta será bloqueada hoje"          |
| Dinheiro fácil                | "Urubu do Pix", lucro garantido          |
| Cobrança falsa                | Governo, Correios                        |
| Pedido de código              | Código de verificação por SMS/WhatsApp   |

### 3. Relatório de risco claro

| Nível | Quando |
| ----- | ------ |
| 🔴 **Alto Risco** | Vários indicadores maliciosos **ou** um indicador crítico (ex.: imitação de banco, pedido de código) |
| 🟡 **Requer Atenção** | Padrões incomuns ou falta de histórico |
| ⚪ **Nenhum Indicador Conhecido Encontrado** | Sem sinais óbvios, mas o app reforça os cuidados |

Cada resultado explica **por que** recebeu essa classificação e **o que fazer** (ex.: "Não clique", "Não faça transferências").

---

## 🚫 Fora do MVP (futuro)

- Leitura automática das notificações do celular em segundo plano.
- Verificação automática de chaves Pix/bancos sem fontes abertas.
- Integração com APIs comerciais pagas.
- Login e cadastro de usuários (o MVP é anônimo e rápido).

O que já foi entregue além do MVP está no [`ROADMAP.md`](ROADMAP.md).

---

## 🔒 Limites e compromisso ético

- **Privacidade:** nenhuma mensagem com senhas, nomes ou dados pessoais é armazenada nos servidores.
- **Sem falsa certeza:** o app deixa claro que nenhum sistema é infalível. Ele apoia a decisão do usuário, não a substitui.
