# 📄 Escopo do Produto e MVP — Antifraude Brasil

## 🎯 1. Problema e Proposta de Valor
Pessoas no Brasil são frequentemente vítimas de golpes virtuais via WhatsApp, SMS, e-mail e links falsos. 
O aplicativo ajuda o usuário a identificar sinais de risco de forma rápida, didática e acessível antes de realizar pagamentos ou fornecer dados pessoais.

---

## 🚀 2. Escopo do MVP (Versão 1.0)
A primeira versão focará exclusivamente em **análise sob demanda** enviada pelo próprio usuário.

### 📱 Funcionalidades Incluídas no MVP:
1. **Analisador de Links e URLs:**
   * Usuário cola um link suspeito.
   * O sistema analisa padrões do domínio (ex: uso de HTTPS, erros de digitação de marcas famosas como `banc0.com`, domínios recém-registrados, TLDs de alto risco como `.xyz`, `.top`).
   * Verificação via bases conhecidas e abertas.
2. **Analisador de Textos/Mensagens de Engenharia Social:**
   * Usuário cola uma mensagem recebida.
   * Classificador baseado em regras locais para identificar urgência artificial ("sua conta será bloqueada hoje"), promessas de dinheiro fácil ("Urubu do Pix"), cobranças falsas do governo/Correios e pedidos de código de verificação.
3. **Relatório de Risco Claro:**
   * Classificação em 3 níveis:
     * 🔴 **Alto Risco / Suspeito** (Múltiplos indicadores maliciosos **ou** um indicador crítico isolado, ex.: imitação de banco, pedido de código de verificação).
     * 🟡 **Requer Atenção** (Padrões incomuns ou falta de histórico).
     * ⚪ **Nenhum Indicador Conhecido Encontrado** (Sem sinais óbvios, mas reforça cuidados).
   * Explicação simples do *porquê* da classificação e o que fazer em seguida (ex: "Não clique", "Não faça transferências").

### 🚫 Funcionalidades Fora do MVP (Futuro):
* Leitura automática de notificações do celular em segundo plano.
* Verificação automática de chaves Pix/bancos sem fontes abertas.
* Integrações com APIs comerciais pagas.
* Sistema de login/cadastro de usuários complexo (o MVP prioriza uso anônimo/rápido).

---

## 🔒 3. Limitações e Compromisso Ético
* **Privacidade:** Nenhuma mensagem contendo senhas, nomes ou dados pessoais sensíveis deve ser armazenada nos servidores.
* **Isenção de Falsa Certeza:** O produto deixará claro que nenhum sistema é 100% infalível e servirá como uma ferramenta de apoio à decisão do usuário.