# 🧠 Log de Arquitetura: z1GateKeeper

Este documento registra a evolução intelectual e os requisitos técnicos que levaram à criação do **z1GateKeeper** pela **PluGzOne**.

## 📅 Contexto Histórico
- **Data**: Janeiro de 2026.
- **Autor**: André Rutz Porto (PluGzOne).
- **Objetivo**: Criar um Air-Gap Cognitivo para Agentes de IA via SSH.

## 🛠️ Evolução do Pensamento Arquitetural

### 1. A Base: Túnel SSH em PHP/Node
A conversa iniciou com a necessidade de criar túneis SSH programáticos. Identificou-se que em 2026, embora o PHP (libssh2) seja viável, o Node.js (`ssh2`) oferece melhor suporte para streams assíncronos e manipulação de PTY.

### 2. O Problema: "Erros Bizantinos" de IA
Agentes de IA (LLMs) podem alucinar comandos destrutivos. A solução proposta foi um **Confirm-Gate**: interceptar o comando, pausar a execução e exigir aprovação humana.

### 3. A Solução: Resposta Universal e Transparência
Para evitar que a IA entrasse em deadlock (achando que o servidor caiu), implementou-se o protocolo de **Notificação de Sistema**. O Proxy informa à IA que o comando está em fila (`[SYSTEM] Command Queued`), permitindo que o agente continue outras tarefas de leitura.

### 4. O Upgrade: Persistência com Screen
Integração nativa com `GNU Screen`. Toda conexão de IA é forçada para dentro de uma sessão persistente (`IA_WORKSPACE`), permitindo auditoria visual em tempo real pelo administrador.

### 5. A Inovação: Audit Batching (Ticket-Based)
Para evitar a fadiga do analista humano e impedir ataques de "Salami Slicing" (onde a IA fatia comandos perigosos para enganar o filtro), o sistema foi evoluído para:
- **Modo de Leitura**: Livre e rápido.
- **Modo de Escrita (Bloqueio)**: Inicia um buffer de comandos.
- **Ticket de Auditoria**: Uma IA local (Llama 3) analisa todo o histórico e o buffer, gerando um resumo de intenção para aprovação única do humano.

## 🛡️ Definições de Identidade (2026)
- **NHI (Non-Human Identities)**: O projeto define que IAs devem se identificar no SSH para aplicação de políticas diferenciadas.
- **Protocolo de Confiança**: Uso de chaves ED25519 e autenticação baseada em Proxy de Identidade.

## 🏢 Créditos
- **Idealização**: André Rutz Porto <andre@plugzone.com.br>
- **Empresa**: [PluGzOne](https://plugz.one)

---
*Este log serve como base para futuras expansões do z1GateKeeper para suporte a múltiplos agentes e auditoria baseada em blockchain.*
