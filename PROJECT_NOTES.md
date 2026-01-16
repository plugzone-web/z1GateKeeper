# 📝 Notas do Projeto - z1GateKeeper

## 🎯 Visão Geral

**z1GateKeeper** é um proxy SSH de governança cognitiva para agentes de IA, criado pela PluGzOne. Implementa um "Air-Gap Cognitivo" que intercepta comandos potencialmente perigosos e requer aprovação humana antes da execução.

## 🏗️ Arquitetura

### Componentes Principais

1. **z1GateKeeper.js** - Servidor SSH Proxy principal
2. **lib/stateManager.js** - Gerenciador de estado centralizado (EventEmitter)
3. **lib/database.js** - Gerenciador SQLite para histórico persistente
4. **web/server.js** - Servidor Express + Socket.io para dashboard web
5. **web/public/** - Interface web (HTML, CSS, JS)

### Fluxo de Dados

```
[Cliente SSH] → [z1GateKeeper Proxy :2222] → [Servidor Destino :22]
                      ↓
              [State Manager] ← → [SQLite DB]
                      ↓
              [Web Dashboard :3000]
```

## 🔑 Decisões de Design Importantes

### 1. Screen Opcional
- **Decisão**: GNU Screen é opcional (desabilitado por padrão)
- **Motivo**: Evita problemas de TTY/sinais e simplifica setup
- **Config**: `"screen": { "enabled": false }`
- **Quando usar**: Apenas se precisar de sessões persistentes que sobrevivem desconexões

### 2. Banco de Dados SQLite
- **Localização**: `./data/z1gatekeeper.db`
- **Tabelas**:
  - `connections` - Histórico de conexões
  - `tickets` - Histórico de tickets
- **Persistência**: Histórico mantido entre reinicializações

### 3. Estado Compartilhado
- **StateManager**: Singleton EventEmitter compartilhado entre SSH proxy e web interface
- **Mesmo processo**: Web interface roda no mesmo Node.js para acesso direto ao estado
- **Eventos**: connection:added, connection:updated, connection:closed, ticket:created, etc.

### 4. Modo Batch Audit
- **Trigger**: Comando não-whitelist detectado
- **Comportamento**: 
  - Comandos são enfileirados
  - Mostra `[QUEUED]` em amarelo
  - Usuário digita `SUBMIT` para solicitar aprovação
  - IA analisa e gera ticket
  - Humano aprova/rejeita no dashboard web
- **Reset**: Após aprovação/rejeição, volta ao modo normal (whitelist passa direto)

## 🎨 Interface Web

### Dashboard Sections

1. **Tickets Pendentes** (Top)
   - Lista todos os tickets aguardando aprovação
   - Botões Aprovar/Rejeitar (ambos desabilitados ao clicar)
   - Mostra análise da IA e comandos bloqueados

2. **Conexões Ativas** (Middle)
   - Preview do terminal (8px, últimas 3 linhas)
   - Botão para tela cheia
   - Informações da conexão

3. **Histórico** (Bottom)
   - Paginado (50 por página)
   - Carregado do SQLite
   - Mostra conexões encerradas

### Real-time Updates
- Socket.io para atualizações em tempo real
- Terminal output streaming
- Auto-refresh a cada 5 segundos

## 🔧 Comandos Especiais

### EXIT / QUIT
- Encerra conexão graciosamente
- Salva histórico no banco
- Fecha todos os streams

### SUBMIT
- Solicita aprovação do batch de comandos
- Gera ticket com análise da IA
- Aguarda aprovação humana

## 🎯 Comportamento de Comandos

### Whitelist
- Comandos de leitura passam imediatamente
- Exemplos: `ls`, `cat`, `grep`, `pwd`, `find`, etc.
- Não requerem aprovação

### Comandos Sensíveis
- Qualquer comando não-whitelist entra em modo bloqueio
- Enfileirados até `SUBMIT`
- Requerem aprovação humana

### Parsing de Comandos
- Comandos com `;` são separados automaticamente
- Exemplo: `ls; pwd; rm file` → 3 comandos separados no ticket
- Quebras de linha são preservadas

## 🎨 Indicadores Visuais

### Modo Auditoria (SSH)
- `[QUEUED]` em amarelo (`\x1b[33m`)
- Prompt original do SSH mantido
- Cores resetadas após aprovação/rejeição

### Dashboard Web
- Preview terminal: 8px, fundo escuro
- Botões: desabilitados imediatamente ao clicar
- Tickets: badges NHI/Human

## 📊 Configuração Importante

### config.json Estrutura

```json
{
  "proxy": {
    "port": 2222,
    "hostKey": "./host.key"
  },
  "destination": {
    "host": "servidor-destino.com",
    "port": 22,
    "username": "usuario",
    "password": "senha" // OU "privateKey": "./keys/key"
  },
  "allowedUsers": {
    "usuario": "senha-proxy"
  },
  "screen": {
    "enabled": false  // Padrão: desabilitado
  },
  "database": {
    "path": "./data/z1gatekeeper.db"
  },
  "web": {
    "enabled": true,
    "port": 3000
  }
}
```

## 🐛 Problemas Conhecidos e Soluções

### Screen TTY Issues
- **Problema**: Sinais TTY causam problemas
- **Solução**: Screen desabilitado por padrão

### Histórico Não Persistia
- **Problema**: Histórico perdido ao reiniciar
- **Solução**: SQLite implementado

### Botões Múltiplos Cliques
- **Problema**: Usuário podia clicar várias vezes
- **Solução**: Ambos botões desabilitados imediatamente com `pointer-events: none`

### Preview Terminal Sumindo
- **Problema**: Preview não aparecia ou sumia
- **Solução**: Sempre atualiza, mostra "..." se vazio, fonte 8px

## 🔐 Segurança

- Autenticação por senha ou chave pública
- Logging completo de todas as operações
- Aprovação humana obrigatória para comandos sensíveis
- Detecção NHI (Non-Human Identities)
- Histórico completo para auditoria

## 📦 Dependências Principais

- `ssh2` - Cliente/Servidor SSH
- `express` - Servidor web
- `socket.io` - WebSockets para real-time
- `better-sqlite3` - Banco de dados SQLite
- `axios` - Cliente HTTP para IA Auditora

## 🚀 Próximos Passos Sugeridos

1. Autenticação no dashboard web
2. Suporte a múltiplos servidores destino
3. Notificações push para tickets pendentes
4. Exportação de histórico (CSV/JSON)
5. Métricas e estatísticas avançadas
6. Suporte a múltiplos modelos de IA

## 📝 Notas de Desenvolvimento

- Versão atual: 2.0+
- Estado: Production Ready
- Última atualização: Janeiro 2026
- Autor: André Rutz Porto (PluGzOne)

## 🔗 Links Úteis

- Repositório: https://github.com/plugzone-web/z1GateKeeper
- Documentação: Ver README.md, SETUP_GUIDE.md, SCREEN_CONFIG.md
- Prompt Original: PROMPT.md (histórico arquitetural)

---

*Este arquivo serve como referência rápida para desenvolvimento futuro e manutenção do projeto.*
