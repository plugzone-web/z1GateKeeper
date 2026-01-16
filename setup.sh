#!/bin/bash
# Script de configuração inicial do z1GateKeeper

echo "🛡️  z1GateKeeper - Setup Inicial"
echo "=================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale Node.js 14+ primeiro."
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado."
    exit 1
fi

echo "✅ npm encontrado: $(npm --version)"

# Instalar dependências
echo ""
echo "📦 Instalando dependências..."
npm install

# Criar config.json se não existir
if [ ! -f "config.json" ]; then
    echo ""
    echo "📝 Criando config.json a partir do exemplo..."
    cp config.json.example config.json
    echo "⚠️  IMPORTANTE: Edite config.json com suas configurações!"
else
    echo "✅ config.json já existe"
fi

# Gerar host key se não existir
if [ ! -f "host.key" ]; then
    echo ""
    echo "🔑 Gerando chave SSH do host..."
    ssh-keygen -t ed25519 -f host.key -N "" -q
    chmod 600 host.key
    echo "✅ Chave gerada: host.key"
else
    echo "✅ host.key já existe"
fi

# Criar diretório de logs
if [ ! -d "logs" ]; then
    echo ""
    echo "📁 Criando diretório de logs..."
    mkdir -p logs
    echo "✅ Diretório criado: logs/"
else
    echo "✅ Diretório logs/ já existe"
fi

echo ""
echo "✨ Setup completo!"
echo ""
echo "Próximos passos:"
echo "1. Edite config.json com suas configurações"
echo "2. Execute: node z1GateKeeper.js"
echo ""
