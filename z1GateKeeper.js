/**
 * z1GateKeeper - Proxy SSH de Governança Cognitiva
 * Créditos: André Rutz Porto (andre@plugzone.com.br) | PluGzOne (https://plugz.one)
 */
const { Server, Client } = require('ssh2');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');

// Configurações de Destino
const DESTINO = { host: 'seu-servidor-real.com', port: 22, username: 'usuario', password: 'sua-senha' };
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const WHITELIST_LEITURA = /^(ls|cat|grep|pwd|find|stat|df|du)(\s|$)/;

let bufferComandos = [];
let emModoBloqueio = false;

async function gerarRelatorioTicket(historico, comandosBloqueados) {
    try {
        const res = await axios.post('http://localhost:11434/api/generate', {
            model: 'llama3:8b',
            prompt: `Analise: HISTÓRICO: ${historico.join(' | ')} | BLOQUEADOS: ${comandosBloqueados.map(c => c.cmd).join(' | ')}. Resuma a intenção e riscos.`,
            stream: false
        });
        return res.data.response;
    } catch (e) { return "Erro na IA Auditora. Revise manualmente."; }
}

new Server({ hostKeys: [fs.readFileSync('./host.key')] }, (client) => {
    client.on('authentication', (ctx) => ctx.accept());
    client.on('ready', () => {
        client.on('session', (accept) => {
            const session = accept();
            session.on('shell', (accept) => {
                const stream = accept();
                const connReal = new Client();
                let historicoLeitura = [];

                connReal.on('ready', () => {
                    connReal.shell({ term: 'xterm-256color' }, (err, realStream) => {
                        realStream.write('screen -R -S IA_BATCH_WORKSPACE\n');
                        stream.on('data', async (data) => {
                            const comando = data.toString().trim();
                            if (!comando) return;
                            if (WHITELIST_LEITURA.test(comando) && !emModoBloqueio) {
                                historicoLeitura.push(comando);
                                return realStream.write(data);
                            }
                            if (!emModoBloqueio) {
                                emModoBloqueio = true;
                                stream.write(`\r\n[z1GateKeeper] Sensitive command. Entering BATCH AUDIT mode. Send 'SUBMIT' to request human review.\r\n`);
                            }
                            if (comando === 'SUBMIT') {
                                const analise = await gerarRelatorioTicket(historicoLeitura, bufferComandos);
                                console.log(`\n--- TICKET DE OPERAÇÃO PLUGZONE ---\n${analise}`);
                                rl.question('Aprovar bloco? (s/n): ', (answer) => {
                                    if (answer.toLowerCase() === 's') {
                                        bufferComandos.forEach(c => realStream.write(c.raw));
                                    }
                                    bufferComandos = []; emModoBloqueio = false; stream.resume();
                                });
                            } else {
                                bufferComandos.push({ cmd: comando, raw: data });
                                stream.write(`[QUEUED]: ${comando}\r\n`);
                            }
                        });
                        realStream.on('data', (data) => stream.write(data));
                    });
                }).connect(DESTINO);
            });
        });
    });
}).listen(2222, () => console.log('z1GateKeeper ativo na porta 2222'));
