/**
 * State Manager - Centralized state and event emitter for z1GateKeeper
 * Separates concerns between SSH proxy and web interface
 */
const EventEmitter = require('events');
const DatabaseManager = require('./database');

class StateManager extends EventEmitter {
    constructor(dbPath) {
        super();
        this.activeConnections = new Map();
        this.pendingTickets = new Map(); // ticketId -> ticket data
        this.db = new DatabaseManager(dbPath);
        this.stats = {
            totalConnections: 0,
            totalTickets: 0,
            approvedTickets: 0,
            rejectedTickets: 0,
            startTime: Date.now()
        };
    }

    /**
     * Add or update active connection
     */
    addConnection(sessionId, connectionData) {
        const connection = {
            sessionId,
            ...connectionData,
            status: 'active',
            lastActivity: Date.now(),
            terminalOutput: '', // Store terminal output for web interface
            terminalBuffer: [] // Circular buffer for terminal output (last 1000 lines)
        };
        this.activeConnections.set(sessionId, connection);
        this.stats.totalConnections++;
        
        // Save to database
        this.db.saveConnection({
            sessionId,
            username: connectionData.username,
            ip: connectionData.ip,
            isNHI: connectionData.isNHI || false,
            startTime: connectionData.startTime || Date.now(),
            status: 'active',
            terminalOutput: ''
        });
        
        this.emit('connection:added', connection);
        return connection;
    }
    
    /**
     * Append terminal output to connection
     */
    appendTerminalOutput(sessionId, data) {
        const connection = this.activeConnections.get(sessionId);
        if (connection) {
            const text = data.toString();
            connection.terminalOutput += text;
            connection.terminalBuffer.push(text);
            
            // Keep only last 1000 lines
            if (connection.terminalBuffer.length > 1000) {
                connection.terminalBuffer.shift();
            }
            
            // Limit total output size (keep last 100KB)
            if (connection.terminalOutput.length > 100000) {
                connection.terminalOutput = connection.terminalBuffer.join('');
            }
            
            connection.lastActivity = Date.now();
            this.emit('terminal:output', { sessionId, data: text });
            return true;
        }
        return false;
    }
    
    /**
     * Get terminal output for a connection
     */
    getTerminalOutput(sessionId) {
        const connection = this.activeConnections.get(sessionId);
        return connection ? connection.terminalOutput : '';
    }

    /**
     * Update connection data
     */
    updateConnection(sessionId, updates) {
        const connection = this.activeConnections.get(sessionId);
        if (connection) {
            Object.assign(connection, updates, { lastActivity: Date.now() });
            
            // Update database if terminal output changed
            if (updates.terminalOutput !== undefined) {
                this.db.updateConnection(sessionId, {
                    terminalOutput: updates.terminalOutput
                });
            }
            
            this.emit('connection:updated', connection);
            return connection;
        }
        return null;
    }

    /**
     * Remove connection and move to history
     */
    removeConnection(sessionId) {
        const connection = this.activeConnections.get(sessionId);
        if (connection) {
            this.activeConnections.delete(sessionId);
            
            const endTime = Date.now();
            const duration = endTime - connection.startTime;
            
            // Save to database
            this.db.closeConnection(
                sessionId,
                endTime,
                duration,
                connection.terminalOutput || ''
            );
            
            // Create history entry
            const historyEntry = {
                ...connection,
                status: 'closed',
                endTime,
                duration
            };
            
            this.emit('connection:closed', historyEntry);
            return historyEntry;
        }
        return null;
    }

    /**
     * Add pending ticket
     */
    addPendingTicket(ticketId, ticketData) {
        const ticket = {
            ticketId,
            ...ticketData,
            status: 'pending',
            createdAt: Date.now()
        };
        this.pendingTickets.set(ticketId, ticket);
        this.stats.totalTickets++;
        
        // Save to database
        this.db.saveTicket({
            ticketId,
            sessionId: ticketData.sessionId,
            username: ticketData.username,
            ip: ticketData.ip,
            isNHI: ticketData.isNHI || false,
            commands: ticketData.commands || [],
            aiAnalysis: ticketData.aiAnalysis || '',
            status: 'pending',
            createdAt: Date.now()
        });
        
        this.emit('ticket:created', ticket);
        return ticket;
    }

    /**
     * Update ticket status
     */
    updateTicket(ticketId, updates) {
        const ticket = this.pendingTickets.get(ticketId);
        if (ticket) {
            Object.assign(ticket, updates);
            if (updates.status === 'approved') {
                this.stats.approvedTickets++;
            } else if (updates.status === 'rejected') {
                this.stats.rejectedTickets++;
            }
            
            // Update database
            this.db.updateTicket(ticketId, updates);
            
            this.emit('ticket:updated', ticket);
            return ticket;
        }
        return null;
    }

    /**
     * Remove ticket (after approval/rejection)
     */
    removeTicket(ticketId) {
        const ticket = this.pendingTickets.get(ticketId);
        if (ticket) {
            this.pendingTickets.delete(ticketId);
            this.emit('ticket:removed', ticket);
            return ticket;
        }
        return null;
    }

    /**
     * Get all active connections
     */
    getActiveConnections() {
        return Array.from(this.activeConnections.values());
    }

    /**
     * Get all pending tickets
     */
    getPendingTickets() {
        return Array.from(this.pendingTickets.values())
            .sort((a, b) => b.createdAt - a.createdAt); // Newest first
    }

    /**
     * Get connection history (paginated) from database
     */
    getConnectionHistory(page = 1, pageSize = 50) {
        return this.db.getConnectionHistory(page, pageSize);
    }

    /**
     * Get connection by sessionId
     */
    getConnection(sessionId) {
        return this.activeConnections.get(sessionId);
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            activeConnections: this.activeConnections.size,
            pendingTickets: this.pendingTickets.size,
            uptime: Date.now() - this.stats.startTime
        };
    }

    /**
     * Get dashboard data (all in one call)
     */
    getDashboardData() {
        // Get recent history from database
        const recentHistory = this.db.getConnectionHistory(1, 10);
        return {
            pendingTickets: this.getPendingTickets(),
            activeConnections: this.getActiveConnections(),
            stats: this.getStats(),
            recentHistory: recentHistory.data || []
        };
    }
    
    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// Factory function to create state manager with database
function createStateManager(dbPath) {
    return new StateManager(dbPath);
}

module.exports = createStateManager;
