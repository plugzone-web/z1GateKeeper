/**
 * Database Manager - SQLite for connection history persistence
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor(dbPath = './data/z1gatekeeper.db') {
        // Ensure data directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new Database(dbPath);
        this.init();
    }

    init() {
        // Create connections table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                ip TEXT NOT NULL,
                is_nhi INTEGER NOT NULL DEFAULT 0,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                duration INTEGER,
                status TEXT NOT NULL DEFAULT 'active',
                terminal_output TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
            );

            CREATE INDEX IF NOT EXISTS idx_session_id ON connections(session_id);
            CREATE INDEX IF NOT EXISTS idx_start_time ON connections(start_time DESC);
            CREATE INDEX IF NOT EXISTS idx_status ON connections(status);
        `);

        // Create tickets table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id TEXT UNIQUE NOT NULL,
                session_id TEXT NOT NULL,
                username TEXT NOT NULL,
                ip TEXT NOT NULL,
                is_nhi INTEGER NOT NULL DEFAULT 0,
                commands TEXT NOT NULL,
                ai_analysis TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
                approved_at INTEGER,
                rejected_at INTEGER,
                FOREIGN KEY (session_id) REFERENCES connections(session_id)
            );

            CREATE INDEX IF NOT EXISTS idx_ticket_id ON tickets(ticket_id);
            CREATE INDEX IF NOT EXISTS idx_ticket_session ON tickets(session_id);
            CREATE INDEX IF NOT EXISTS idx_ticket_status ON tickets(status);
        `);
    }

    /**
     * Save connection to database
     */
    saveConnection(connectionData) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO connections 
            (session_id, username, ip, is_nhi, start_time, status, terminal_output)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            connectionData.sessionId,
            connectionData.username,
            connectionData.ip,
            connectionData.isNHI ? 1 : 0,
            connectionData.startTime,
            connectionData.status || 'active',
            connectionData.terminalOutput || ''
        );
    }

    /**
     * Update connection
     */
    updateConnection(sessionId, updates) {
        const fields = [];
        const values = [];

        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.endTime !== undefined) {
            fields.push('end_time = ?');
            values.push(updates.endTime);
        }
        if (updates.duration !== undefined) {
            fields.push('duration = ?');
            values.push(updates.duration);
        }
        if (updates.terminalOutput !== undefined) {
            fields.push('terminal_output = ?');
            values.push(updates.terminalOutput);
        }

        if (fields.length === 0) return;

        values.push(sessionId);
        const stmt = this.db.prepare(`
            UPDATE connections 
            SET ${fields.join(', ')}
            WHERE session_id = ?
        `);

        stmt.run(...values);
    }

    /**
     * Close connection (move to history)
     */
    closeConnection(sessionId, endTime, duration, terminalOutput = '') {
        const stmt = this.db.prepare(`
            UPDATE connections 
            SET status = 'closed', end_time = ?, duration = ?, terminal_output = ?
            WHERE session_id = ?
        `);

        stmt.run(endTime, duration, terminalOutput, sessionId);
    }

    /**
     * Get connection history (paginated)
     */
    getConnectionHistory(page = 1, pageSize = 50) {
        const offset = (page - 1) * pageSize;

        // Get total count
        const countStmt = this.db.prepare('SELECT COUNT(*) as total FROM connections WHERE status = ?');
        const total = countStmt.get('closed').total;

        // Get paginated results
        const stmt = this.db.prepare(`
            SELECT 
                session_id as sessionId,
                username,
                ip,
                is_nhi as isNHI,
                start_time as startTime,
                end_time as endTime,
                duration,
                status
            FROM connections 
            WHERE status = 'closed'
            ORDER BY end_time DESC
            LIMIT ? OFFSET ?
        `);

        const data = stmt.all(pageSize, offset).map(row => ({
            ...row,
            isNHI: row.isNHI === 1,
            startTime: row.startTime,
            endTime: row.endTime
        }));

        return {
            data,
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        };
    }

    /**
     * Get connection by session ID
     */
    getConnection(sessionId) {
        const stmt = this.db.prepare(`
            SELECT 
                session_id as sessionId,
                username,
                ip,
                is_nhi as isNHI,
                start_time as startTime,
                end_time as endTime,
                duration,
                status,
                terminal_output as terminalOutput
            FROM connections 
            WHERE session_id = ?
        `);

        const row = stmt.get(sessionId);
        if (row) {
            return {
                ...row,
                isNHI: row.isNHI === 1
            };
        }
        return null;
    }

    /**
     * Save ticket
     */
    saveTicket(ticketData) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO tickets 
            (ticket_id, session_id, username, ip, is_nhi, commands, ai_analysis, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            ticketData.ticketId,
            ticketData.sessionId,
            ticketData.username,
            ticketData.ip,
            ticketData.isNHI ? 1 : 0,
            JSON.stringify(ticketData.commands),
            ticketData.aiAnalysis || '',
            ticketData.status || 'pending',
            ticketData.createdAt || Date.now()
        );
    }

    /**
     * Update ticket status
     */
    updateTicket(ticketId, updates) {
        const fields = [];
        const values = [];

        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.approvedAt !== undefined) {
            fields.push('approved_at = ?');
            values.push(updates.approvedAt);
        }
        if (updates.rejectedAt !== undefined) {
            fields.push('rejected_at = ?');
            values.push(updates.rejectedAt);
        }

        if (fields.length === 0) return;

        values.push(ticketId);
        const stmt = this.db.prepare(`
            UPDATE tickets 
            SET ${fields.join(', ')}
            WHERE ticket_id = ?
        `);

        stmt.run(...values);
    }

    /**
     * Close database connection
     */
    close() {
        this.db.close();
    }
}

module.exports = DatabaseManager;
