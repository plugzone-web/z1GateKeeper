# 📖 Guia Completo de Configuração - z1GateKeeper

## 🏗️ Arquitetura

```
[Cliente/IA]  →  [z1GateKeeper Proxy :2222]  →  [Servidor SSH Destino :22]
     |                      |                              |
  Conecta aqui        Filtra comandos              Executa comandos
```

### Dois Servidores SSH:

1. **z1GateKeeper (Proxy)** - Porta 2222
   - Onde você se conecta
   - Filtra e aprova comandos
   - Configurado em `config.json` → `proxy`

2. **Servidor SSH Destino** - Porta 22 (padrão)
   - Onde os comandos são realmente executados
   - Configurado em `config.json` → `destination`

---

## 🔧 Configuração do Servidor Destino

### 1. Edite o `config.json`:

```json
{
  "destination": {
    "host": "192.168.1.100",        // IP ou hostname do servidor destino
    "port": 22,                     // Porta SSH do servidor destino (geralmente 22)
    "username": "usuario_destino",   // Usuário no servidor destino
    "password": "senha_destino",     // Senha OU use privateKey
    "privateKey": "./keys/dest_key", // Caminho para chave privada (alternativa)
    "passphrase": "",                // Senha da chave (se tiver)
    "readyTimeout": 20000
  }
}
```

### 2. Opções de Autenticação no Destino:

#### Opção A: Senha
```json
"destination": {
  "host": "meu-servidor.com",
  "port": 22,
  "username": "root",
  "password": "minha-senha-segura"
}
```

#### Opção B: Chave Privada (Recomendado)
```json
"destination": {
  "host": "meu-servidor.com",
  "port": 22,
  "username": "root",
  "privateKey": "./keys/dest_key",
  "passphrase": ""  // Deixe vazio se a chave não tiver senha
}
```

### 3. Gerar Chave para o Destino (se usar chave):

```bash
# No servidor onde roda o z1GateKeeper
ssh-keygen -t ed25519 -f keys/dest_key -N '""'

# Copiar chave pública para o servidor destino
ssh-copy-id -i keys/dest_key.pub usuario@servidor-destino

# OU manualmente:
cat keys/dest_key.pub | ssh usuario@servidor-destino "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

---

## 🔌 Como Conectar ao Proxy

### 1. Configure Usuários Permitidos no Proxy

No `config.json`:

```json
{
  "allowedUsers": {
    "meu_usuario": "senha_do_proxy",
    "ai_agent_1": {
      "password": "outra_senha",
      "publicKeys": ["./keys/ai_agent_1.pub"]
    }
  }
}
```

### 2. Conecte ao Proxy

#### Por Senha:
```bash
ssh meu_usuario@IP_DO_PROXY -p 2222
# Digite a senha quando solicitado
```

#### Por Chave Pública:
```bash
# Gere uma chave no cliente
ssh-keygen -t ed25519 -f ~/.ssh/id_z1_agent -N '""'

# Copie a chave pública para o servidor do proxy
# (adicione ao config.json em allowedUsers)

# Conecte
ssh meu_usuario@IP_DO_PROXY -p 2222 -i ~/.ssh/id_z1_agent
```

---

## 📝 Exemplo Completo de Configuração

### config.json Completo:

```json
{
  "proxy": {
    "port": 2222,
    "host": "0.0.0.0",
    "hostKey": "./host.key",
    "banner": "z1GateKeeper SSH Proxy - PluGzOne"
  },
  "destination": {
    "host": "192.168.1.100",
    "port": 22,
    "username": "ubuntu",
    "privateKey": "./keys/dest_key"
  },
  "allowedUsers": {
    "admin": "senha-segura-123",
    "ai_bot": {
      "password": "senha-bot-456"
    }
  },
  "aiAuditor": {
    "url": "http://localhost:11434/api/generate",
    "model": "llama3:8b",
    "timeout": 30000
  },
  "whitelist": [
    "ls", "cat", "grep", "pwd", "find", "stat", "df", "du",
    "whoami", "uname", "top", "htop", "ps", "head", "tail"
  ],
  "screen": {
    "sessionName": "IA_BATCH_WORKSPACE"
  },
  "nhiDetection": {
    "enabled": true,
    "patterns": ["^ai_", "^agent_", "^bot_"]
  },
  "auditLog": {
    "enabled": true,
    "path": "./logs/audit.log"
  },
  "web": {
    "enabled": true,
    "port": 3000,
    "host": "0.0.0.0"
  }
}
```

---

## 🚀 Fluxo Completo

### 1. Inicie o z1GateKeeper:
```bash
node z1GateKeeper.js
```

### 2. Conecte ao Proxy (do seu cliente):
```bash
ssh admin@IP_DO_PROXY -p 2222
```

### 3. O que acontece:
- Você autentica no **proxy** (usando `allowedUsers`)
- O proxy conecta ao **servidor destino** (usando `destination`)
- Seus comandos passam pelo filtro do proxy
- Comandos aprovados são executados no servidor destino

---

## ✅ Checklist de Configuração

- [ ] `host.key` gerado (já feito ✓)
- [ ] `config.json` criado a partir de `config.json.example`
- [ ] `destination.host` configurado (IP/hostname do servidor destino)
- [ ] `destination.username` configurado (usuário no servidor destino)
- [ ] `destination.password` OU `destination.privateKey` configurado
- [ ] Chave pública copiada para servidor destino (se usar chave)
- [ ] `allowedUsers` configurado (usuários que podem conectar ao proxy)
- [ ] Teste de conexão ao servidor destino funcionando
- [ ] z1GateKeeper iniciado sem erros

---

## 🔍 Testando a Configuração

### 1. Teste conexão direta ao destino:
```bash
ssh usuario@servidor-destino -p 22
# Se funcionar, a configuração do destino está correta
```

### 2. Teste conexão ao proxy:
```bash
ssh usuario@IP_DO_PROXY -p 2222
# Se funcionar, você verá o shell do servidor destino
```

### 3. Verifique logs:
```bash
# Logs do z1GateKeeper aparecem no console
# Logs de auditoria em ./logs/audit.log
```

---

## 🆘 Troubleshooting

### Erro: "Erro de conexão com destino"
- Verifique se o servidor destino está acessível
- Teste: `ping servidor-destino`
- Verifique credenciais em `destination`

### Erro: "Permission denied" no destino
- Verifique usuário e senha/chave
- Teste conexão direta: `ssh usuario@destino`
- Verifique se a chave pública está em `~/.ssh/authorized_keys` no destino

### Erro: "Falha na autenticação" no proxy
- Verifique se o usuário está em `allowedUsers`
- Verifique senha/chave pública configurada

### Não consigo conectar ao proxy
- Verifique se o z1GateKeeper está rodando
- Verifique firewall (porta 2222 deve estar aberta)
- Verifique `proxy.host` e `proxy.port` no config.json
