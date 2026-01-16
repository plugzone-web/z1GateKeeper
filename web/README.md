# Web Interface - z1GateKeeper Dashboard

## Overview

The web interface provides a real-time dashboard for monitoring and managing z1GateKeeper operations. It runs in the same Node.js process as the SSH proxy but is completely separated in code structure.

## Architecture

- **Same Process**: Runs alongside SSH proxy for direct state access
- **Separated Code**: All web code in `web/` directory
- **Real-time Updates**: Uses Socket.io for live updates
- **REST API**: Express endpoints for data access

## Features

### Dashboard Sections

1. **Pending Tickets** (Top)
   - Shows all tickets awaiting human approval
   - Displays AI analysis, blocked commands, and connection info
   - Approve/Reject buttons for each ticket

2. **Active Connections** (Middle)
   - Real-time view of all active SSH connections
   - Shows connection details, duration, and queued commands
   - NHI (Non-Human Identity) badges

3. **Connection History** (Bottom)
   - Paginated list of closed connections
   - Shows duration, timestamps, and connection details
   - Navigation controls for pagination

### Real-time Updates

- New connections appear automatically
- Tickets update in real-time
- Connection status changes instantly
- No page refresh needed

## Configuration

Add to `config.json`:

```json
{
  "web": {
    "enabled": true,
    "port": 3000,
    "host": "0.0.0.0"
  }
}
```

## Access

Once enabled, access the dashboard at:
- `http://localhost:3000` (if host is 0.0.0.0)
- `http://your-server-ip:3000`

## API Endpoints

### GET `/api/dashboard`
Returns complete dashboard data (pending tickets, active connections, stats)

### GET `/api/history?page=1&pageSize=50`
Returns paginated connection history

### POST `/api/tickets/:ticketId/approve`
Approve or reject a ticket
Body: `{ "approved": true }` or `{ "approved": false }`

## Socket.io Events

### Client → Server
- `dashboard:refresh` - Request dashboard update
- `ticket:approve` - Approve/reject ticket

### Server → Client
- `dashboard:data` - Full dashboard update
- `ticket:created` - New ticket created
- `ticket:updated` - Ticket status changed
- `connection:added` - New connection
- `connection:updated` - Connection updated
- `connection:closed` - Connection closed

## File Structure

```
web/
├── server.js          # Express + Socket.io server
├── public/
│   ├── index.html     # Dashboard HTML
│   ├── css/
│   │   └── style.css  # Dashboard styling
│   └── js/
│       └── app.js     # Frontend JavaScript
└── README.md          # This file
```

## Security Notes

- The web interface has no authentication by default
- Consider adding authentication for production use
- The interface exposes connection details and commands
- Use firewall rules to restrict access if needed
