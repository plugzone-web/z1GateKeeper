# 🛡️ z1GateKeeper (2026)
**Proxy SSH de Governança para Agentes de IA**

Versão: 2.0 - Production Ready

## 📋 Descrição

O **z1GateKeeper** é um proxy SSH avançado que implementa um "Air-Gap Cognitivo" para agentes de IA. Ele intercepta comandos potencialmente perigosos, os agrupa em lotes e requer aprovação humana antes da execução, enquanto permite que comandos de leitura seguros passem livremente.

## ✨ Características Principais

- ✅ **Filtragem Whitelist**: Comandos de leitura seguros passam imediatamente
- ✅ **Modo Batch Audit**: Comandos sensíveis são agrupados para revisão
- ✅ **IA Auditora Integrada**: Análise automática de intenção e riscos (Ollama/Llama)
- ✅ **Autenticação Flexível**: Suporte a senha e chaves públicas (ED25519/RSA)
- ✅ **Detecção NHI**: Identificação automática de identidades não-humanas
- ✅ **GNU Screen**: Sessões persistentes para auditoria visual
- ✅ **Logging de Auditoria**: Registro completo de todas as operações
- ✅ **Graceful Shutdown**: Encerramento seguro com preservação de conexões
- ✅ **Multi-conexão**: Suporte a múltiplas sessões simultâneas
- ✅ **Dashboard Web**: Interface web em tempo real para monitoramento e aprovação de tickets

## 🚀 Instalação

### Pré-requisitos

- Node.js 14+ 
- GNU Screen
- Ollama (para IA Auditora) - opcional

### Passos

1. Clone ou baixe o projeto
2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure o arquivo `config.json` (veja `config.json.example`)

4. Gere uma chave SSH para o proxy:
   ```bash
   ssh-keygen -t ed25519 -f host.key -N ""
   ```

5. Execute:
   ```bash
   node z1GateKeeper.js
   ```

## ⚙️ Configuração

Veja `config.json.example` para todas as opções disponíveis.

### Configurações Principais

- **proxy**: Configuração do servidor proxy SSH
- **destination**: Servidor SSH de destino
- **allowedUsers**: Usuários permitidos e métodos de autenticação
- **aiAuditor**: Configuração da IA Auditora (Ollama)
- **whitelist**: Lista de comandos permitidos sem bloqueio
- **nhiDetection**: Padrões para detectar identidades não-humanas
- **auditLog**: Configuração de logging de auditoria

## 🔌 Conexão

### Para Agentes de IA

```bash
ssh usuario@proxy-ip -p 2222
```

### Com Chave Pública

```bash
ssh usuario@proxy-ip -p 2222 -i id_z1_agent
```

## 🌐 Dashboard Web

O z1GateKeeper inclui um dashboard web para monitoramento em tempo real:

1. **Tickets Pendentes**: Visualize e aprove/rejeite tickets de comandos bloqueados
2. **Conexões Ativas**: Monitore todas as conexões SSH ativas
3. **Histórico**: Navegue pelo histórico de conexões encerradas

### Acesso

Após habilitar no `config.json`, acesse:
- `http://localhost:3000` (padrão)

### Configuração

```json
{
  "web": {
    "enabled": true,
    "port": 3000,
    "host": "0.0.0.0"
  }
}
```

Veja `web/README.md` para mais detalhes.

## 📖 Como Funciona

1. **Conexão**: Cliente conecta ao proxy SSH
2. **Autenticação**: Proxy valida credenciais (senha ou chave)
3. **Shell**: Proxy estabelece conexão com servidor de destino
4. **Screen**: Sessão é forçada para GNU Screen para persistência
5. **Filtragem**: 
   - Comandos whitelist → Passam imediatamente
   - Comandos sensíveis → Entram em modo bloqueio
6. **Batch**: Comandos bloqueados são agrupados
7. **Auditoria**: IA analisa histórico e comandos bloqueados
8. **Aprovação**: Humano revisa e aprova/rejeita o lote
9. **Execução**: Comandos aprovados são executados

## 🔒 Segurança

- Autenticação por senha ou chave pública
- Logging completo de todas as operações
- Isolamento de comandos sensíveis
- Análise de risco automatizada
- Aprovação humana obrigatória

## 📝 Logs

Os logs de auditoria são salvos em `./logs/audit.log` (configurável) e incluem:
- Conexões e autenticações
- Comandos executados e bloqueados
- Tickets gerados e decisões
- Erros e eventos do sistema

## 🛠️ Desenvolvimento

### Estrutura

- `z1GateKeeper.js` - Código principal
- `config.json` - Configuração (não versionado)
- `config.json.example` - Exemplo de configuração
- `PROMPT.md` - Histórico arquitetural

### Melhorias da Versão 2.0

- ✅ Autenticação por chave pública
- ✅ Detecção de NHI (Non-Human Identities)
- ✅ Logging estruturado e persistente
- ✅ Graceful shutdown
- ✅ Melhor tratamento de erros
- ✅ Suporte a multi-conexão
- ✅ Timeout configurável para IA
- ✅ Validação de configuração
- ✅ Parsing melhorado de comandos

## 📄 Licença

Proprietário - PluGzOne

## 👤 Créditos

**Idealização**: André Rutz Porto <andre@plugzone.com.br>  
**Empresa**: [PluGzOne](https://plugz.one)

---

*Para mais detalhes sobre a arquitetura, veja `PROMPT.md`*
