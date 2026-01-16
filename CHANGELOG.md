# Changelog - z1GateKeeper

## Versão 2.0 - Production Ready

### ✨ Novas Funcionalidades

- **Autenticação por Chave Pública**: Suporte completo para autenticação via chaves SSH (ED25519 e RSA), além de senha
- **Detecção NHI (Non-Human Identities)**: Identificação automática de agentes de IA baseada em padrões de nome de usuário
- **Logging de Auditoria Persistente**: Sistema completo de logging estruturado com timestamps e persistência em arquivo
- **Graceful Shutdown**: Encerramento seguro que aguarda conexões ativas antes de finalizar
- **Validação de Configuração**: Verificação completa da configuração na inicialização
- **Multi-conexão**: Suporte robusto para múltiplas sessões simultâneas
- **Timeout Configurável**: Timeout configurável para chamadas à IA Auditora
- **Parsing Melhorado**: Tratamento adequado de comandos multi-linha, pipes e caracteres especiais

### 🔧 Melhorias

- **Tratamento de Erros**: Sistema robusto de tratamento de erros em todas as camadas
- **Logging Estruturado**: Logs com níveis (INFO, WARN, ERROR, AUDIT) e metadados estruturados
- **Regex Whitelist**: Correção do regex de whitelist para escapar caracteres especiais corretamente
- **Screen Session**: Melhor inicialização e gerenciamento de sessões GNU Screen
- **IA Auditora**: Melhor tratamento de erros, timeouts e suporte a diferentes formatos de resposta
- **Tickets**: Sistema de tickets melhorado com IDs únicos e informações detalhadas
- **Conexões Ativas**: Rastreamento de conexões ativas para monitoramento

### 🐛 Correções

- Correção do regex de whitelist que não escapava caracteres especiais
- Melhor tratamento de comandos vazios e caracteres de controle
- Correção de race conditions na inicialização do screen
- Melhor handling de desconexões inesperadas

### 📝 Documentação

- README.md completamente reescrito com documentação completa
- INSTALL.md expandido com instruções detalhadas
- CONNECT.md com guia completo de conexão
- config.json.example atualizado com todas as novas opções
- CHANGELOG.md criado para rastreamento de versões

### 🛠️ Infraestrutura

- Script setup.sh para configuração inicial automatizada
- .gitignore atualizado para incluir logs e chaves
- Suporte a variável de ambiente CONFIG_PATH

### 🔒 Segurança

- Validação rigorosa de configuração
- Permissões adequadas para arquivos sensíveis
- Logging de todas as operações de segurança
- Suporte a múltiplas chaves de host

### 📊 Métricas e Monitoramento

- Rastreamento de duração de sessões
- Contagem de comandos por sessão
- Logs de auditoria com contexto completo
- Identificação de usuários NHI

---

## Versão 1.0 - Initial Release

Funcionalidades básicas:
- Proxy SSH básico
- Filtragem por whitelist
- Modo batch audit
- Integração com IA Auditora (Ollama)
- Integração com GNU Screen
