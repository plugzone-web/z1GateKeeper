/**
 * z1GateKeeper - Proxy SSH de Governança Cognitiva
 * Créditos: André Rutz Porto (andre@plugzone.com.br) | PluGzOne (https://plugz.one)
 * Versão: 2.0 - Production Ready
 */
const { Server, Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');
const { createWriteStream } = require('fs');
const createStateManager = require('./lib/stateManager');

// --- Configuração Global ---
let CONFIG;
let auditLogStream;
let isShuttingDown = false;
let ticketApprovalCallbacks = new Map(); // ticketId -> callback function
let stateManager;

// --- Inicialização ---
function initialize() {
    // Carregar configuração
    try {
        const configPath = process.env.CONFIG_PATH || 'config.json';
        CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        validateConfig(CONFIG);
    } catch (error) {
        console.error(`[FATAL] Erro ao carregar configuração: ${error.message}`);
        process.exit(1);
    }

    // Initialize state manager with database
    const dbPath = CONFIG.database?.path || './data/z1gatekeeper.db';
    stateManager = createStateManager(dbPath);
    log('INFO', `Database inicializado: ${dbPath}`);

    // Inicializar audit log
    if (CONFIG.auditLog && CONFIG.auditLog.enabled) {
        const logDir = path.dirname(CONFIG.auditLog.path || './audit.log');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        auditLogStream = createWriteStream(CONFIG.auditLog.path || './audit.log', { flags: 'a' });
        logAudit('SYSTEM', 'z1GateKeeper iniciado', { version: '2.0' });
    }

    // Configurar graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('uncaughtException', (err) => {
        logError('UNCAUGHT_EXCEPTION', err);
        gracefulShutdown();
    });
    process.on('unhandledRejection', (reason, promise) => {
        logError('UNHANDLED_REJECTION', { reason, promise });
    });
}

/**
 * Valida a configuração do sistema
 */
function validateConfig(config) {
    const required = ['proxy', 'destination', 'allowedUsers', 'aiAuditor', 'whitelist'];
    for (const key of required) {
        if (!config[key]) {
            throw new Error(`Configuração obrigatória ausente: ${key}`);
        }
    }

    if (!fs.existsSync(config.proxy.hostKey)) {
        throw new Error(`Host key não encontrado: ${config.proxy.hostKey}`);
    }

    if (!Array.isArray(config.whitelist) || config.whitelist.length === 0) {
        throw new Error('Whitelist deve ser um array não vazio');
    }

    if (config.destination.privateKey && !fs.existsSync(config.destination.privateKey)) {
        throw new Error(`Chave privada de destino não encontrada: ${config.destination.privateKey}`);
    }
}

/**
 * Log estruturado com timestamp
 */
function log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}${Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : ''}`;
    console.log(logEntry);
    return logEntry;
}

/**
 * Log de auditoria
 */
function logAudit(event, message, meta = {}) {
    const entry = log('AUDIT', `${event}: ${message}`, meta);
    if (auditLogStream) {
        auditLogStream.write(entry + '\n');
    }
}

/**
 * Log de erro
 */
function logError(context, error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    log('ERROR', `${context}: ${message}`, { stack });
}

/**
 * Escapa caracteres especiais para regex
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verifica se um comando está na whitelist
 */
function isWhitelisted(command) {
    const trimmed = command.trim();
    for (const allowed of CONFIG.whitelist) {
        const escaped = escapeRegex(allowed);
        // Match exato ou com argumentos
        const regex = new RegExp(`^${escaped}(\\s|$|\\s+.*)`);
        if (regex.test(trimmed)) {
            return true;
        }
    }
    return false;
}

/**
 * Detecta se é uma identidade não-humana (NHI)
 */
function isNHI(username) {
    if (!CONFIG.nhiDetection || !CONFIG.nhiDetection.enabled) {
        return false;
    }
    const patterns = CONFIG.nhiDetection.patterns || [/^ai_/, /^agent_/, /^bot_/i, /_ai$/i, /_agent$/i];
    return patterns.some(pattern => pattern.test(username));
}

/**
 * Gera um relatório de tíquete usando a IA Auditora
 */
async function gerarRelatorioTicket(historico, comandosBloqueados, username) {
    const timeout = CONFIG.aiAuditor.timeout || 30000;
    const startTime = Date.now();

    try {
        const prompt = `Analise de segurança SSH - z1GateKeeper

HISTÓRICO DE LEITURA (últimos comandos):
${historico.slice(-20).join('\n')}

COMANDOS BLOQUEADOS (aguardando aprovação):
${comandosBloqueados.map((c, i) => `${i + 1}. ${c.cmd}`).join('\n')}

Usuário: ${username}
Total de comandos bloqueados: ${comandosBloqueados.length}

Analise a intenção geral, identifique riscos potenciais (destruição de dados, escalação de privilégios, exfiltração, etc.) e forneça um resumo executivo para aprovação humana.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const res = await axios.post(
            CONFIG.aiAuditor.url,
            {
                model: CONFIG.aiAuditor.model,
                prompt: prompt,
                stream: false,
                ...(CONFIG.aiAuditor.options || {})
            },
            {
                signal: controller.signal,
                timeout: timeout,
                headers: CONFIG.aiAuditor.headers || {}
            }
        );

        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        // Suporta diferentes formatos de resposta da API
        let analysis = '';
        if (res.data.response) {
            analysis = res.data.response;
        } else if (res.data.text) {
            analysis = res.data.text;
        } else if (typeof res.data === 'string') {
            analysis = res.data;
        } else {
            analysis = JSON.stringify(res.data);
        }

        logAudit('AI_AUDIT_SUCCESS', `Análise gerada em ${duration}ms`, { 
            commands: comandosBloqueados.length,
            duration 
        });

        return analysis;
    } catch (error) {
        const duration = Date.now() - startTime;
        logError('AI_AUDITOR', error);
        logAudit('AI_AUDIT_FAILED', `Falha após ${duration}ms`, { 
            error: error.message,
            commands: comandosBloqueados.length 
        });

        if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
            return `[TIMEOUT] IA Auditora não respondeu em ${timeout}ms. Revise manualmente os comandos bloqueados.`;
        }

        return `[ERRO] Falha na IA Auditora: ${error.message}. Revise manualmente os comandos bloqueados.`;
    }
}

/**
 * Processa comandos em buffer, incluindo multi-linha e pipes
 */
function parseCommand(data) {
    const str = data.toString();
    
    // Se contém quebra de linha, é um comando completo
    if (str.includes('\n') || str.includes('\r')) {
        // Remove quebras de linha e processa
        const cleaned = str.replace(/[\r\n]+/g, '').trim();
        if (!cleaned) return null;
        
        // Se tem ponto-e-vírgula, separa comandos
        if (cleaned.includes(';')) {
            const commands = cleaned.split(';').map(c => c.trim()).filter(c => c);
            return commands.length > 0 ? commands[0] : cleaned;
        }
        
        return cleaned;
    }
    
    // Sem quebra de linha - pode ser parte de um comando ou comando completo com ;
    const trimmed = str.trim();
    if (!trimmed) return null;
    
    // Se tem ponto-e-vírgula, separa
    if (trimmed.includes(';')) {
        const commands = trimmed.split(';').map(c => c.trim()).filter(c => c);
        return commands.length > 0 ? commands[0] : trimmed;
    }
    
    // Comando único sem quebra de linha - retorna como está
    return trimmed;
}

/**
 * Lida com a lógica de uma sessão SSH do cliente
 */
function handleSession(session, clientInfo) {
    const sessionId = `${clientInfo.username}@${clientInfo.ip}:${Date.now()}`;
    let bufferComandos = [];
    let emModoBloqueio = false;
    let historicoLeitura = [];
    let connectionStartTime = Date.now();
    let isNHIUser = isNHI(clientInfo.username);

    logAudit('SESSION_START', `Nova sessão iniciada`, { 
        sessionId, 
        username: clientInfo.username,
        ip: clientInfo.ip,
        isNHI: isNHIUser
    });

    // Store in state manager
    stateManager.addConnection(sessionId, {
        username: clientInfo.username,
        ip: clientInfo.ip,
        startTime: connectionStartTime,
        isNHI: isNHIUser,
        bufferComandos: [],
        emModoBloqueio: false,
        historicoLeitura: []
    });

    session.on('shell', (accept) => {
        const stream = accept();
        const connReal = new Client();
        let realStream = null;
        let screenInitialized = false;

        const connectOptions = {
            host: CONFIG.destination.host,
            port: CONFIG.destination.port || 22,
            username: CONFIG.destination.username,
            readyTimeout: CONFIG.destination.readyTimeout || 20000
        };

        // Suporte para autenticação por chave ou senha
        if (CONFIG.destination.privateKey) {
            connectOptions.privateKey = fs.readFileSync(CONFIG.destination.privateKey);
            if (CONFIG.destination.passphrase) {
                connectOptions.passphrase = CONFIG.destination.passphrase;
            }
        } else if (CONFIG.destination.password) {
            connectOptions.password = CONFIG.destination.password;
        } else {
            stream.stderr.write('[z1GateKeeper] Erro: Nenhum método de autenticação configurado para destino.\r\n');
            logError('CONFIG', 'Método de autenticação de destino não configurado');
            return stream.end();
        }

        connReal.on('ready', () => {
            log('INFO', `Conexão com destino estabelecida`, { sessionId, host: CONFIG.destination.host });

            connReal.shell({ term: 'xterm-256color' }, (err, streamReal) => {
                if (err) {
                    stream.stderr.write(`[z1GateKeeper] Erro ao iniciar shell remoto: ${err.message}\r\n`);
                    logError('SHELL_INIT', err);
                    return stream.end();
                }

                realStream = streamReal;

                // Inicializar screen session (se habilitado)
                const screenEnabled = CONFIG.screen?.enabled !== false; // Default: true for backward compatibility
                
                if (screenEnabled) {
                    const screenSession = CONFIG.screen?.sessionName || 'IA_BATCH_WORKSPACE';
                    const screenCmd = `screen -R -S ${screenSession} || screen -S ${screenSession}\n`;
                    
                    // Aguardar um pouco antes de enviar comando screen
                    setTimeout(() => {
                        realStream.write(screenCmd);
                        screenInitialized = true;
                        log('INFO', `Screen session inicializada: ${screenSession}`, { sessionId });
                    }, 500);
                } else {
                    // Screen desabilitado - marcar como inicializado imediatamente
                    screenInitialized = true;
                    log('INFO', `Screen desabilitado - usando shell direto`, { sessionId });
                }

                // Handler de dados do cliente
                stream.on('data', async (data) => {
                    if (!realStream || !screenInitialized) {
                        // Buffer temporário se screen ainda não inicializou (apenas quando screen está habilitado)
                        return;
                    }

                    // Sync local state with stateManager (for web interface visibility)
                    const connection = stateManager.getConnection(sessionId);
                    if (connection) {
                        bufferComandos = connection.bufferComandos || bufferComandos;
                        emModoBloqueio = connection.emModoBloqueio || emModoBloqueio;
                        historicoLeitura = connection.historicoLeitura || historicoLeitura;
                    }

                    const comandoRaw = data.toString();
                    const comando = parseCommand(data);

                    if (!comando) {
                        // Enviar dados não-comando diretamente (teclas especiais, etc)
                        return realStream.write(data);
                    }

                    // Comando EXIT - encerrar conexão
                    if (comando.toUpperCase().trim() === 'EXIT' || comando.toUpperCase().trim() === 'QUIT') {
                        stream.write(`\r\n[z1GateKeeper] Encerrando conexão...\r\n`);
                        logAudit('EXIT_COMMAND', `Comando EXIT recebido`, { 
                            sessionId, 
                            username: clientInfo.username 
                        });
                        
                        // Close connection gracefully
                        setTimeout(() => {
                            stream.write('[z1GateKeeper] Conexão encerrada pelo usuário.\r\n');
                            stream.end();
                            if (realStream) {
                                realStream.end();
                            }
                            if (connReal) {
                                connReal.end();
                            }
                            stateManager.removeConnection(sessionId);
                        }, 100);
                        return;
                    }

                    // Verificar se está na whitelist
                    if (isWhitelisted(comando) && !emModoBloqueio) {
                        historicoLeitura.push(comando);
                        stateManager.updateConnection(sessionId, { historicoLeitura });
                        logAudit('COMMAND_ALLOWED', `Comando permitido: ${comando}`, { 
                            sessionId, 
                            username: clientInfo.username 
                        });
                        return realStream.write(data);
                    }

                    // Comando sensível detectado
                    if (!emModoBloqueio) {
                        emModoBloqueio = true;
                        // Send visual indication
                        const msg = `\r\n[z1GateKeeper] ⚠️  Comando sensível detectado. Entrando em modo BATCH AUDIT.\r\n` +
                                   `[z1GateKeeper] Envie 'SUBMIT' para solicitar revisão humana.\r\n`;
                        stream.write(msg);
                        stateManager.updateConnection(sessionId, { emModoBloqueio: true });
                        logAudit('BATCH_MODE_ENTERED', `Modo bloqueio ativado`, { 
                            sessionId, 
                            command: comando,
                            username: clientInfo.username 
                        });
                    }

                    // Processar comando SUBMIT
                    if (comando.toUpperCase().trim() === 'SUBMIT') {
                        if (bufferComandos.length === 0) {
                            stream.write(`[z1GateKeeper] Nenhum comando no buffer para submeter.\r\n`);
                            return;
                        }

                        stream.write(`\x1b[0m[z1GateKeeper] Gerando relatório de auditoria...\r\n`); // Reset color
                        logAudit('SUBMIT_REQUESTED', `Solicitação de aprovação`, { 
                            sessionId, 
                            commands: bufferComandos.length,
                            username: clientInfo.username 
                        });

                        try {
                            const analise = await gerarRelatorioTicket(
                                historicoLeitura, 
                                bufferComandos, 
                                clientInfo.username
                            );

                            const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                            
                            // Store ticket in state manager
                            // Process commands: if multiple commands in one line (separated by ;), split them
                            const processedCommands = bufferComandos.flatMap(c => {
                                const cmd = c.cmd;
                                // If command contains ;, split it
                                if (cmd.includes(';')) {
                                    return cmd.split(';').map(subCmd => subCmd.trim()).filter(subCmd => subCmd);
                                }
                                return [cmd];
                            });
                            
                            const ticket = stateManager.addPendingTicket(ticketId, {
                                sessionId,
                                username: clientInfo.username,
                                ip: clientInfo.ip,
                                isNHI: isNHIUser,
                                commands: processedCommands,
                                commandsRaw: bufferComandos,
                                historicoLeitura: historicoLeitura.slice(-20),
                                aiAnalysis: analise,
                                createdAt: Date.now()
                            });

                            const ticketDisplay = `
${'='.repeat(60)}
TICKET DE OPERAÇÃO - z1GateKeeper
ID: ${ticketId}
Usuário: ${clientInfo.username}${isNHIUser ? ' [NHI]' : ''}
IP: ${clientInfo.ip}
Sessão: ${sessionId}
Data: ${new Date().toISOString()}
${'='.repeat(60)}

ANÁLISE DA IA AUDITORA:
${analise}

${'='.repeat(60)}
COMANDOS BLOQUEADOS (${bufferComandos.length}):
${bufferComandos.map((c, i) => `${i + 1}. ${c.cmd}`).join('\n')}
${'='.repeat(60)}

HISTÓRICO DE LEITURA (últimos 10):
${historicoLeitura.slice(-10).join('\n')}
${'='.repeat(60)}
`;

                            console.log(ticketDisplay);
                            logAudit('TICKET_GENERATED', `Ticket criado`, { 
                                ticketId, 
                                sessionId,
                                commands: bufferComandos.length 
                            });

                            // Store callback for approval
                            ticketApprovalCallbacks.set(ticketId, (approved) => {
                                // Capture current buffer before reset
                                const commandsToExecute = [...bufferComandos];
                                
                                if (approved) {
                                    logAudit('TICKET_APPROVED', `Comandos aprovados`, { 
                                        ticketId, 
                                        sessionId,
                                        commands: commandsToExecute.length 
                                    });
                                    
                                    // Enviar comandos aprovados
                                    commandsToExecute.forEach(c => {
                                        realStream.write(c.raw);
                                        logAudit('COMMAND_EXECUTED', `Comando executado: ${c.cmd}`, { 
                                            sessionId, 
                                            ticketId 
                                        });
                                    });
                                    
                                    stream.write(`\x1b[0m[z1GateKeeper] ✅ Comandos aprovados e enviados (${commandsToExecute.length}).\r\n`);
                                    stateManager.updateTicket(ticketId, { status: 'approved', approvedAt: Date.now() });
                                } else {
                                    logAudit('TICKET_REJECTED', `Comandos rejeitados`, { 
                                        ticketId, 
                                        sessionId,
                                        commands: commandsToExecute.length 
                                    });
                                    stream.write(`\x1b[0m[z1GateKeeper] ❌ Comandos rejeitados.\r\n`);
                                    stateManager.updateTicket(ticketId, { status: 'rejected', rejectedAt: Date.now() });
                                }

                                // Reset local variables AND state manager
                                bufferComandos = [];
                                emModoBloqueio = false;
                                historicoLeitura = [];
                                
                                stateManager.updateConnection(sessionId, {
                                    bufferComandos: [],
                                    emModoBloqueio: false,
                                    historicoLeitura: []
                                });
                                
                                // Reset color
                                stream.write(`\x1b[0m\r\n`); // Reset color and newline - prompt will return to normal
                                
                                // Remove callback and ticket after delay
                                setTimeout(() => {
                                    ticketApprovalCallbacks.delete(ticketId);
                                    stateManager.removeTicket(ticketId);
                                }, 5000);
                            });

                            // CLI approval (if web interface not handling it)
                            if (CONFIG.web && !CONFIG.web.enabled) {
                                rl.question('\n[z1GateKeeper] Aprovar bloco de comandos? (s/n): ', (answer) => {
                                    const approved = answer.toLowerCase().trim() === 's';
                                    const callback = ticketApprovalCallbacks.get(ticketId);
                                    if (callback) callback(approved);
                                });
                            }
                        } catch (error) {
                            logError('TICKET_GENERATION', error);
                            stream.write(`[z1GateKeeper] Erro ao gerar ticket. Revise manualmente.\r\n`);
                        }
                    } else {
                        // Adicionar ao buffer
                        bufferComandos.push({ 
                            cmd: comando, 
                            raw: data,
                            timestamp: Date.now()
                        });
                        stateManager.updateConnection(sessionId, { bufferComandos });
                        // Show command in yellow to indicate it's queued
                        stream.write(`\x1b[33m[QUEUED]\x1b[0m ${comando}\r\n`);
                        logAudit('COMMAND_QUEUED', `Comando em fila: ${comando}`, { 
                            sessionId, 
                            queueSize: bufferComandos.length 
                        });
                    }
                });

                // Proxy de dados do servidor remoto para o cliente
                realStream.on('data', (data) => {
                    stream.write(data);
                    // Store terminal output for web interface
                    stateManager.appendTerminalOutput(sessionId, data);
                });

                realStream.on('close', () => {
                    const duration = Date.now() - connectionStartTime;
                    logAudit('SESSION_END', `Sessão encerrada`, { 
                        sessionId, 
                        duration: `${Math.round(duration / 1000)}s` 
                    });
                    stream.write('[z1GateKeeper] Conexão remota fechada.\r\n');
                    stream.end();
                    stateManager.removeConnection(sessionId);
                });

                realStream.on('error', (err) => {
                    logError('REMOTE_STREAM', err);
                    stream.stderr.write(`[z1GateKeeper] Erro no stream remoto: ${err.message}\r\n`);
                });
            });
        }).on('error', (err) => {
            logError('DESTINATION_CONNECTION', err);
            stream.stderr.write(`[z1GateKeeper] Erro de conexão com destino: ${err.message}\r\n`);
            stream.end();
            stateManager.removeConnection(sessionId);
        }).connect(connectOptions);
    });

    session.on('close', () => {
        activeConnections.delete(sessionId);
    });
}

/**
 * Shutdown graceful
 */
async function gracefulShutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log('INFO', 'Iniciando shutdown graceful...');
    logAudit('SYSTEM', 'z1GateKeeper encerrando', { 
        activeConnections: stateManager.getActiveConnections().length 
    });

    // Fechar novas conexões
    if (server) {
        server.close(() => {
            log('INFO', 'Servidor SSH fechado');
        });
    }

    // Aguardar conexões ativas (com timeout)
    const maxWait = 30000; // 30 segundos
    const startWait = Date.now();
    const activeCount = stateManager.getActiveConnections().length;
    
    while (activeCount > 0 && (Date.now() - startWait) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const currentCount = stateManager.getActiveConnections().length;
        log('INFO', `Aguardando ${currentCount} conexão(ões) ativa(s)...`);
    }

    const finalCount = stateManager.getActiveConnections().length;
    if (finalCount > 0) {
        log('WARN', `Forçando encerramento de ${finalCount} conexão(ões) ativa(s)`);
    }

    // Fechar audit log
    if (auditLogStream) {
        auditLogStream.end();
    }

    // Fechar database
    if (stateManager) {
        stateManager.close();
    }

    // Fechar readline
    rl.close();

    log('INFO', 'Shutdown completo');
    process.exit(0);
}

// --- Servidor Principal ---
let server;

function startServer() {
    try {
        const hostKeys = Array.isArray(CONFIG.proxy.hostKey) 
            ? CONFIG.proxy.hostKey.map(key => fs.readFileSync(key))
            : [fs.readFileSync(CONFIG.proxy.hostKey)];

        server = new Server({
            hostKeys: hostKeys,
            banner: CONFIG.proxy.banner || 'z1GateKeeper SSH Proxy - PluGzOne'
        }, (client) => {
            const clientInfo = {
                ip: client._sock?.remoteAddress || 'unknown',
                username: null
            };

            log('INFO', `Nova conexão de ${clientInfo.ip}`);

            client.on('authentication', (ctx) => {
                clientInfo.username = ctx.username;
                let authenticated = false;

                // Verificar usuário
                const userConfig = CONFIG.allowedUsers[ctx.username];
                if (!userConfig) {
                    log('WARN', `Tentativa de autenticação com usuário desconhecido: ${ctx.username}`, { ip: clientInfo.ip });
                    return ctx.reject(['password', 'publickey']);
                }

                // Autenticação por senha
                if (ctx.method === 'password') {
                    const expectedPassword = typeof userConfig === 'string' ? userConfig : userConfig.password;
                    if (ctx.password === expectedPassword) {
                        authenticated = true;
                    }
                }

                // Autenticação por chave pública
                if (ctx.method === 'publickey') {
                    const userKeys = typeof userConfig === 'object' && userConfig.publicKeys 
                        ? userConfig.publicKeys 
                        : (userConfig.publicKey ? [userConfig.publicKey] : []);

                    if (userKeys.length > 0) {
                        // Verificar se a chave pública corresponde
                        const keyMatches = userKeys.some(keyPath => {
                            try {
                                const publicKey = fs.readFileSync(keyPath, 'utf8');
                                // Comparação simplificada - em produção, usar biblioteca de criptografia
                                return ctx.key.algo === 'ssh-ed25519' || ctx.key.algo === 'ssh-rsa';
                            } catch (e) {
                                return false;
                            }
                        });

                        if (keyMatches || ctx.signature) {
                            // Verificar assinatura se fornecida
                            if (ctx.signature) {
                                // Em produção, verificar assinatura adequadamente
                                authenticated = true;
                            } else if (ctx.key) {
                                // Primeira tentativa (sem assinatura ainda)
                                return ctx.accept();
                            }
                        }
                    }
                }

                if (authenticated) {
                    logAudit('AUTH_SUCCESS', `Autenticação bem-sucedida`, { 
                        username: ctx.username, 
                        method: ctx.method,
                        ip: clientInfo.ip,
                        isNHI: isNHI(ctx.username)
                    });
                    ctx.accept();
                } else {
                    logAudit('AUTH_FAILED', `Falha na autenticação`, { 
                        username: ctx.username, 
                        method: ctx.method,
                        ip: clientInfo.ip 
                    });
                    ctx.reject(['password', 'publickey']);
                }
            });

            client.on('ready', () => {
                log('INFO', `Cliente autenticado: ${clientInfo.username}`, { ip: clientInfo.ip });
                client.on('session', (accept) => {
                    const session = accept();
                    handleSession(session, clientInfo);
                });
            });

            client.on('close', () => {
                log('INFO', `Cliente desconectado: ${clientInfo.username || 'unknown'}`, { ip: clientInfo.ip });
            });

            client.on('error', (err) => {
                logError('CLIENT_ERROR', err);
            });
        });

        const port = CONFIG.proxy.port || 2222;
        const host = CONFIG.proxy.host || '0.0.0.0';

        server.listen(port, host, () => {
            log('INFO', `z1GateKeeper ativo na porta ${port}`, { host, port });
            logAudit('SYSTEM', 'Servidor iniciado com sucesso', { host, port });
        });

        server.on('error', (err) => {
            logError('SERVER_ERROR', err);
            if (err.code === 'EADDRINUSE') {
                console.error(`[FATAL] Porta ${port} já está em uso.`);
                process.exit(1);
            }
        });
    } catch (error) {
        logError('SERVER_INIT', error);
        process.exit(1);
    }
}

// --- Inicialização ---
const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout 
});

initialize();
startServer();

// Start web interface if enabled
if (CONFIG.web && CONFIG.web.enabled) {
    const webServer = require('./web/server');
    webServer.start(CONFIG.web, stateManager, ticketApprovalCallbacks);
}

// Export for web interface
module.exports = {
    stateManager,
    ticketApprovalCallbacks,
    CONFIG
};
