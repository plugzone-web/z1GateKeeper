/**
 * z1GateKeeper Dashboard - Frontend JavaScript
 */
const socket = io();
let currentHistoryPage = 1;
let totalHistoryPages = 1;

// Terminal subscriptions
const terminalSubscriptions = new Map(); // sessionId -> { element, output }

// Socket connection events
socket.on('connect', () => {
    console.log('Connected to server');
    loadDashboard();
    loadHistory(1);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Terminal output events
socket.on('terminal:output', (data) => {
    const { sessionId, data: output } = data;
    const sub = terminalSubscriptions.get(sessionId);
    if (sub) {
        sub.output += output;
        updateTerminalDisplay(sessionId, sub.output);
    }
});

socket.on('terminal:data', (data) => {
    const { sessionId, output } = data;
    const sub = terminalSubscriptions.get(sessionId);
    if (sub) {
        sub.output = output;
        updateTerminalDisplay(sessionId, output);
    }
});

// Real-time updates
socket.on('dashboard:data', (data) => {
    updateDashboard(data);
});

socket.on('ticket:created', (ticket) => {
    loadDashboard();
});

socket.on('ticket:updated', (data) => {
    loadDashboard();
});

socket.on('connection:added', () => {
    loadDashboard();
});

socket.on('connection:updated', () => {
    loadDashboard();
});

socket.on('connection:closed', () => {
    loadDashboard();
    loadHistory(currentHistoryPage);
});

// Load dashboard data
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();
        updateDashboard(data);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Update dashboard UI
function updateDashboard(data) {
    // Update stats
    document.getElementById('stat-active').textContent = data.stats.activeConnections;
    document.getElementById('stat-pending').textContent = data.stats.pendingTickets;
    document.getElementById('stat-total').textContent = data.stats.totalConnections;
    document.getElementById('stat-uptime').textContent = formatUptime(data.stats.uptime);

    // Update pending tickets
    updatePendingTickets(data.pendingTickets);

    // Update active connections
    updateActiveConnections(data.activeConnections);
}

// Update pending tickets section
function updatePendingTickets(tickets) {
    const container = document.getElementById('pending-tickets');
    
    if (tickets.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum ticket pendente</p>';
        return;
    }

    container.innerHTML = tickets.map(ticket => `
        <div class="ticket" data-ticket-id="${ticket.ticketId}">
            <div class="ticket-header">
                <span class="ticket-id">${ticket.ticketId}</span>
                <span class="ticket-badge ${ticket.isNHI ? 'badge-nhi' : 'badge-human'}">
                    ${ticket.isNHI ? 'NHI' : 'Human'}
                </span>
            </div>
            <div class="ticket-info">
                <div class="ticket-info-item">
                    <span class="ticket-info-label">Usuário:</span>
                    <span>${ticket.username}</span>
                </div>
                <div class="ticket-info-item">
                    <span class="ticket-info-label">IP:</span>
                    <span>${ticket.ip}</span>
                </div>
                <div class="ticket-info-item">
                    <span class="ticket-info-label">Sessão:</span>
                    <span style="font-family: monospace; font-size: 0.85em;">${ticket.sessionId}</span>
                </div>
                <div class="ticket-info-item">
                    <span class="ticket-info-label">Criado:</span>
                    <span>${formatDate(ticket.createdAt)}</span>
                </div>
            </div>
            <div class="ticket-commands">
                <div class="ticket-commands-title">Comandos Bloqueados (${ticket.commands.length}):</div>
                ${ticket.commands.map((cmd, i) => `
                    <div class="command-item">${i + 1}. ${escapeHtml(cmd)}</div>
                `).join('')}
            </div>
            ${ticket.aiAnalysis ? `
                <div class="ticket-analysis">
                    <strong>Análise da IA:</strong><br>
                    ${escapeHtml(ticket.aiAnalysis)}
                </div>
            ` : ''}
            <div class="ticket-actions">
                <button class="btn btn-approve" id="btn-approve-${ticket.ticketId}" onclick="approveTicket('${ticket.ticketId}', true)">
                    ✅ Aprovar
                </button>
                <button class="btn btn-reject" id="btn-reject-${ticket.ticketId}" onclick="approveTicket('${ticket.ticketId}', false)">
                    ❌ Rejeitar
                </button>
            </div>
        </div>
    `).join('');
}

// Update active connections section
function updateActiveConnections(connections) {
    const container = document.getElementById('active-connections');
    
    if (connections.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhuma conexão ativa</p>';
        return;
    }

    container.innerHTML = connections.map(conn => `
        <div class="connection">
            <div class="connection-header">
                <span class="connection-id">${conn.sessionId}</span>
                <span class="connection-status">Ativa</span>
            </div>
            <div class="connection-info">
                <div><strong>Usuário:</strong> ${conn.username} ${conn.isNHI ? '<span class="ticket-badge badge-nhi">NHI</span>' : ''}</div>
                <div><strong>IP:</strong> ${conn.ip}</div>
                <div><strong>Duração:</strong> ${formatDuration(Date.now() - conn.startTime)}</div>
                ${conn.bufferComandos && conn.bufferComandos.length > 0 ? `
                    <div class="connection-queue">
                        <strong>Comandos em fila:</strong> ${conn.bufferComandos.length}
                        <span class="queue-badge">${conn.bufferComandos.length} aguardando</span>
                    </div>
                ` : ''}
            </div>
            <div class="connection-terminal">
                <div class="terminal-preview" id="terminal-preview-${conn.sessionId}">
                    <div class="terminal-preview-content"></div>
                </div>
                <button class="btn btn-secondary btn-fullscreen" onclick="openTerminalFullscreen('${conn.sessionId}')">
                    📺 Ver Terminal (Tela Cheia)
                </button>
            </div>
        </div>
    `).join('');
    
    // Subscribe to terminal output for each connection
    connections.forEach(conn => {
        const previewId = `terminal-preview-${conn.sessionId}`;
        const previewElement = document.getElementById(previewId);
        
        if (previewElement) {
            if (!terminalSubscriptions.has(conn.sessionId)) {
                terminalSubscriptions.set(conn.sessionId, {
                    element: previewElement,
                    output: conn.terminalOutput || ''
                });
                socket.emit('terminal:subscribe', { sessionId: conn.sessionId });
            }
            // Always update preview, even if subscription exists
            updateTerminalPreview(conn.sessionId, conn.terminalOutput || '');
        }
    });
}

// Load connection history
async function loadHistory(page) {
    try {
        const response = await fetch(`/api/history?page=${page}&pageSize=50`);
        const data = await response.json();
        updateHistory(data);
        currentHistoryPage = page;
        totalHistoryPages = data.totalPages;
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Update history section
function updateHistory(data) {
    const container = document.getElementById('connection-history');
    const pageInfo = document.getElementById('page-info');
    
    pageInfo.textContent = `Página ${data.page} de ${data.totalPages || 1}`;
    
    // Update pagination buttons
    document.getElementById('prev-page').disabled = data.page <= 1;
    document.getElementById('next-page').disabled = data.page >= data.totalPages;

    if (data.data.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum histórico disponível</p>';
        return;
    }

    container.innerHTML = data.data.map(conn => `
        <div class="history-item closed">
            <div>
                <span class="history-label">Sessão:</span>
                <span class="history-value" style="font-family: monospace; font-size: 0.85em;">${conn.sessionId}</span>
            </div>
            <div>
                <span class="history-label">Usuário:</span>
                <span class="history-value">${conn.username} ${conn.isNHI ? '<span class="ticket-badge badge-nhi">NHI</span>' : ''}</span>
            </div>
            <div>
                <span class="history-label">IP:</span>
                <span class="history-value">${conn.ip}</span>
            </div>
            <div>
                <span class="history-label">Duração:</span>
                <span class="history-value">${formatDuration(conn.duration)}</span>
            </div>
            <div>
                <span class="history-label">Encerrada:</span>
                <span class="history-value">${formatDate(conn.endTime)}</span>
            </div>
        </div>
    `).join('');
}

// Approve/reject ticket
async function approveTicket(ticketId, approved) {
    const approveBtn = document.getElementById(`btn-approve-${ticketId}`);
    const rejectBtn = document.getElementById(`btn-reject-${ticketId}`);
    
    // Disable BOTH buttons immediately to prevent multiple clicks
    if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.style.pointerEvents = 'none';
        approveBtn.style.opacity = '0.6';
        approveBtn.textContent = approved ? '⏳ Processando...' : '✅ Aprovar';
    }
    if (rejectBtn) {
        rejectBtn.disabled = true;
        rejectBtn.style.pointerEvents = 'none';
        rejectBtn.style.opacity = '0.6';
        rejectBtn.textContent = approved ? '❌ Rejeitar' : '⏳ Processando...';
    }
    
    try {
        const response = await fetch(`/api/tickets/${ticketId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ approved })
        });

        const result = await response.json();
        
        if (result.success) {
            // Update button states - keep disabled
            if (approveBtn) {
                approveBtn.textContent = approved ? '✅ Aprovado' : '✅ Aprovar';
            }
            if (rejectBtn) {
                rejectBtn.textContent = approved ? '❌ Rejeitar' : '❌ Rejeitado';
            }
            
            // Reload dashboard after a short delay
            setTimeout(() => loadDashboard(), 1000);
        } else {
            alert('Erro ao processar ticket: ' + result.message);
            // Re-enable buttons on error
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.style.pointerEvents = 'auto';
                approveBtn.style.opacity = '1';
            }
            if (rejectBtn) {
                rejectBtn.disabled = false;
                rejectBtn.style.pointerEvents = 'auto';
                rejectBtn.style.opacity = '1';
            }
        }
    } catch (error) {
        console.error('Error approving ticket:', error);
        alert('Erro ao processar ticket');
        // Re-enable buttons on error
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.style.pointerEvents = 'auto';
            approveBtn.style.opacity = '1';
        }
        if (rejectBtn) {
            rejectBtn.disabled = false;
            rejectBtn.style.pointerEvents = 'auto';
            rejectBtn.style.opacity = '1';
        }
    }
}

// Pagination handlers
document.getElementById('prev-page').addEventListener('click', () => {
    if (currentHistoryPage > 1) {
        loadHistory(currentHistoryPage - 1);
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    if (currentHistoryPage < totalHistoryPages) {
        loadHistory(currentHistoryPage + 1);
    }
});

// Utility functions
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR');
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function formatUptime(ms) {
    return formatDuration(ms);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Terminal functions
function updateTerminalPreview(sessionId, output) {
    const preview = document.getElementById(`terminal-preview-${sessionId}`);
    if (preview) {
        const content = preview.querySelector('.terminal-preview-content');
        if (content) {
            // Show last few lines - always show something
            if (output && output.trim().length > 0) {
                const lines = output.split('\n').filter(line => line.trim().length > 0);
                const lastLines = lines.slice(-3).join('\n'); // Last 3 non-empty lines
                content.textContent = lastLines || output.slice(-100); // Fallback to last 100 chars
            } else {
                content.textContent = '...'; // Show something to indicate it's working
            }
            
            // Always ensure content is visible
            if (content.textContent.trim().length === 0) {
                content.textContent = '...';
            }
        }
    }
}

function updateTerminalDisplay(sessionId, output) {
    const display = document.getElementById('terminal-display');
    if (display && display.dataset.sessionId === sessionId) {
        display.textContent = output;
        display.scrollTop = display.scrollHeight;
    }
    
    // Also update preview
    updateTerminalPreview(sessionId, output);
}

function openTerminalFullscreen(sessionId) {
    const modal = document.getElementById('terminal-modal');
    const display = document.getElementById('terminal-display');
    const sessionIdEl = document.getElementById('terminal-session-id');
    
    if (modal && display && sessionIdEl) {
        const sub = terminalSubscriptions.get(sessionId);
        if (sub) {
            display.dataset.sessionId = sessionId;
            display.textContent = sub.output || '';
            sessionIdEl.textContent = `Terminal: ${sessionId}`;
            modal.style.display = 'flex';
            display.scrollTop = display.scrollHeight;
        }
    }
}

function closeTerminalFullscreen() {
    const modal = document.getElementById('terminal-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close terminal modal
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('terminal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTerminalFullscreen);
    }
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTerminalFullscreen();
        }
    });
});

// Auto-refresh every 5 seconds
setInterval(() => {
    loadDashboard();
}, 5000);
