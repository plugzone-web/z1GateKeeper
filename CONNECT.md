# 🔌 Guia de Conexão

## Conexão Básica

### Para Agentes de IA

```bash
ssh usuario@proxy-ip -p 2222
```

### Com Chave Pública

```bash
ssh usuario@proxy-ip -p 2222 -i ~/.ssh/id_z1_agent
```

## Autenticação

### Por Senha

O z1GateKeeper suporta autenticação por senha. Configure no `config.json`:

```json
"allowedUsers": {
    "meu_usuario": "minha_senha_segura"
}
```

### Por Chave Pública

Para maior segurança, use chaves SSH:

1. **Gere uma chave no cliente:**
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/id_z1_agent -N ""
   ```

2. **Configure no servidor `config.json`:**
   ```json
   "allowedUsers": {
       "meu_usuario": {
           "publicKey": "/caminho/para/id_z1_agent.pub"
       }
   }
   ```

3. **Conecte:**
   ```bash
   ssh meu_usuario@proxy-ip -p 2222 -i ~/.ssh/id_z1_agent
   ```

## Identidades Não-Humanas (NHI)

O sistema detecta automaticamente agentes de IA baseado em padrões de nome de usuário:

- `ai_*`
- `agent_*`
- `bot_*`
- `*_ai`
- `*_agent`
- `*_bot`

Exemplo:
```bash
ssh ai_agent_1@proxy-ip -p 2222
```

## Fluxo de Trabalho

1. **Conexão**: Conecte ao proxy
2. **Autenticação**: Forneça credenciais
3. **Shell**: Você será conectado ao servidor de destino via Screen
4. **Comandos de Leitura**: Comandos whitelist passam imediatamente
5. **Comandos Sensíveis**: Entram em modo bloqueio
6. **Submissão**: Envie `SUBMIT` para solicitar aprovação
7. **Aprovação**: Aguarde aprovação humana (se necessário)

## Exemplo de Sessão

```
$ ssh usuario@proxy-ip -p 2222
Password: ********
[z1GateKeeper] Conectado ao servidor de destino

$ ls
file1.txt  file2.txt  # ✅ Passou (whitelist)

$ rm file1.txt
[z1GateKeeper] ⚠️  Comando sensível detectado. Entrando em modo BATCH AUDIT.
[z1GateKeeper] Envie 'SUBMIT' para solicitar revisão humana.
[QUEUED] rm file1.txt

$ echo "test" > file2.txt
[QUEUED] echo "test" > file2.txt

$ SUBMIT
[z1GateKeeper] Gerando relatório de auditoria...
[z1GateKeeper] ✅ Comandos aprovados e enviados (2).
```

## Troubleshooting

### "Connection refused"
- Verifique se o proxy está rodando
- Verifique a porta (padrão: 2222)
- Verifique firewall

### "Permission denied"
- Verifique credenciais no `config.json`
- Verifique se o usuário está em `allowedUsers`

### "Host key verification failed"
- Adicione a chave do host: `ssh-keyscan -p 2222 proxy-ip >> ~/.ssh/known_hosts`
