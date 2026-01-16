# 📦 Instalação do z1GateKeeper

## Requisitos do Sistema

### Ubuntu/Debian

```bash
# Instalar Node.js (versão 14 ou superior)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar GNU Screen
sudo apt-get install -y screen

# Instalar Ollama (opcional, para IA Auditora)
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3:8b
```

### AlmaLinux/RHEL/CentOS

```bash
# Instalar Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Instalar GNU Screen
sudo yum install -y screen

# Instalar Ollama (opcional)
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3:8b
```

## Instalação do Projeto

1. **Clone ou extraia o projeto**

2. **Instale as dependências Node.js:**
   ```bash
   npm install
   ```

3. **Configure o arquivo de configuração:**
   ```bash
   cp config.json.example config.json
   nano config.json  # ou use seu editor preferido
   ```

4. **Gere a chave SSH do host:**
   ```bash
   ssh-keygen -t ed25519 -f host.key -N ""
   # ou para RSA:
   ssh-keygen -t rsa -b 4096 -f host.key -N ""
   ```

5. **Configure permissões (importante para segurança):**
   ```bash
   chmod 600 host.key
   chmod 600 config.json
   ```

6. **Crie diretório de logs:**
   ```bash
   mkdir -p logs
   ```

## Verificação

Execute o servidor:
```bash
node z1GateKeeper.js
```

Você deve ver:
```
[YYYY-MM-DDTHH:mm:ss.sssZ] [INFO] z1GateKeeper ativo na porta 2222
```

## Configuração do Firewall

Se necessário, abra a porta do proxy:
```bash
# UFW (Ubuntu)
sudo ufw allow 2222/tcp

# firewalld (RHEL/CentOS)
sudo firewall-cmd --permanent --add-port=2222/tcp
sudo firewall-cmd --reload
```

## Execução como Serviço (Systemd)

Crie `/etc/systemd/system/z1gatekeeper.service`:

```ini
[Unit]
Description=z1GateKeeper SSH Proxy
After=network.target

[Service]
Type=simple
User=seu-usuario
WorkingDirectory=/caminho/para/z1GateKeeper
ExecStart=/usr/bin/node /caminho/para/z1GateKeeper/z1GateKeeper.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Ative o serviço:
```bash
sudo systemctl enable z1gatekeeper
sudo systemctl start z1gatekeeper
sudo systemctl status z1gatekeeper
```

## Troubleshooting

### Erro: "Porta já em uso"
- Verifique se outra instância está rodando: `netstat -tulpn | grep 2222`
- Mude a porta em `config.json`

### Erro: "Host key não encontrado"
- Gere a chave: `ssh-keygen -t ed25519 -f host.key -N ""`

### Erro: "Erro na IA Auditora"
- Verifique se Ollama está rodando: `curl http://localhost:11434/api/tags`
- Ajuste a URL em `config.json` se necessário

### Permissões negadas
- Verifique permissões: `ls -la host.key config.json`
- Ajuste: `chmod 600 host.key config.json`
