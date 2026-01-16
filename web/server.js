/**
 * Web Interface Server for z1GateKeeper
 * Express + Socket.io for real-time dashboard
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

let app;
let server;
let io;
let stateManager;
let ticketCallbacks;

function start(webConfig, sm, callbacks) {
    stateManager = sm;
    ticketCallbacks = callbacks;

    app = express();
    server = http.createServer(app);
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Serve static files
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.json());

    // API endpoint for ticket approval
    app.post('/api/tickets/:ticketId/approve', (req, res) => {
        const { ticketId } = req.params;
        const { approved } = req.body;
        
        const callback = ticketCallbacks.get(ticketId);
        if (callback) {
            callback(approved === true || approved === 'true');
            res.json({ success: true, message: approved ? 'Ticket approved' : 'Ticket rejected' });
        } else {
            res.status(404).json({ success: false, message: 'Ticket not found or already processed' });
        }
    });

    // API endpoint for dashboard data
    app.get('/api/dashboard', (req, res) => {
        res.json(stateManager.getDashboardData());
    });

    // API endpoint for connection history (paginated)
    app.get('/api/history', (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        res.json(stateManager.getConnectionHistory(page, pageSize));
    });

    // API endpoint for terminal output
    app.get('/api/terminal/:sessionId', (req, res) => {
        const { sessionId } = req.params;
        const output = stateManager.getTerminalOutput(sessionId);
        res.json({ sessionId, output });
    });

    // Socket.io connection handling
    io.on('connection', (socket) => {
        console.log(`[Web] Client connected: ${socket.id}`);

        // Send initial dashboard data
        socket.emit('dashboard:data', stateManager.getDashboardData());

        // Listen for ticket approval
        socket.on('ticket:approve', (data) => {
            const { ticketId, approved } = data;
            const callback = ticketCallbacks.get(ticketId);
            if (callback) {
                callback(approved);
                // Broadcast update to all clients
                io.emit('ticket:updated', { ticketId, approved });
            }
        });

        // Request dashboard update
        socket.on('dashboard:refresh', () => {
            socket.emit('dashboard:data', stateManager.getDashboardData());
        });

        // Request terminal output for a connection
        socket.on('terminal:subscribe', (data) => {
            const { sessionId } = data;
            const output = stateManager.getTerminalOutput(sessionId);
            socket.emit('terminal:data', { sessionId, output });
        });

        socket.on('disconnect', () => {
            console.log(`[Web] Client disconnected: ${socket.id}`);
        });
    });

    // Listen to state manager events and broadcast to clients
    stateManager.on('connection:added', (connection) => {
        io.emit('connection:added', connection);
        io.emit('dashboard:data', stateManager.getDashboardData());
    });

    stateManager.on('connection:updated', (connection) => {
        io.emit('connection:updated', connection);
    });

    stateManager.on('connection:closed', (connection) => {
        io.emit('connection:closed', connection);
        io.emit('dashboard:data', stateManager.getDashboardData());
    });

    stateManager.on('ticket:created', (ticket) => {
        io.emit('ticket:created', ticket);
        io.emit('dashboard:data', stateManager.getDashboardData());
    });

    stateManager.on('ticket:updated', (ticket) => {
        io.emit('ticket:updated', ticket);
        io.emit('dashboard:data', stateManager.getDashboardData());
    });

    stateManager.on('ticket:removed', (ticket) => {
        io.emit('ticket:removed', ticket);
        io.emit('dashboard:data', stateManager.getDashboardData());
    });

    // Broadcast terminal output in real-time
    stateManager.on('terminal:output', (data) => {
        io.emit('terminal:output', data);
    });

    // Start server
    const port = webConfig.port || 3000;
    const host = webConfig.host || '0.0.0.0';
    
    server.listen(port, host, () => {
        console.log(`[Web] Dashboard disponível em http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    });

    server.on('error', (err) => {
        console.error(`[Web] Erro no servidor: ${err.message}`);
    });
}

function stop() {
    if (io) {
        io.close();
    }
    if (server) {
        server.close();
    }
}

module.exports = { start, stop };
