# Socket.IO Setup Guide

## Overview
This guide explains how Socket.IO is configured for real-time messaging with JWT authentication in the Pandav MSG application.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │◄────────┤  Socket.IO   │────────►│  Server     │
│  (Browser)  │  WebSocket Connection  │         │  (Node.js)  │
└─────────────┘         └──────────────┘         └─────────────┘
```

---

## Installation

Install Socket.IO:

```bash
cd backend
npm install socket.io
# or
bun add socket.io
```

---

## Implementation

### 1. Server Setup (`src/server.js`)

The main entry point that creates HTTP server and attaches Socket.IO:

```javascript
import http from 'http'
import app from "./app";
import { createSocketServer } from './socket/socket.server.js';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app)
createSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Key Point:** Use `httpServer.listen()` not `app.listen()` to support WebSocket connections.

---

### 2. Socket Server Setup (`src/socket/socket.server.js`)

Creates Socket.IO server with CORS and authentication:

```javascript
import { Server } from 'socket.io'
import { socketAuthMiddleware } from './socket.auth.js'
import { registerSocketEvents } from './socket.event.js'

export function createSocketServer(httpServer){
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true
        }
    });

    io.use(socketAuthMiddleware)
    
    io.on("connection", (socket) => {
        registerSocketEvents(io, socket)
    });

    console.log("[SOCKET] Socket.io Initialized")

    return io
}
```

---

### 3. Authentication Middleware (`src/socket/socket.auth.js`)

Validates JWT tokens on connection:

- Extracts token from `socket.handshake.auth.token` or `Authorization` header
- Verifies JWT validity
- Blocks unauthenticated connections
- Attaches user data to socket

**Token Sources (in priority order):**
1. `socket.handshake.auth.token` (recommended)
2. `Authorization: Bearer <token>` header

---

### 4. Response Messages (`src/constant/response.messages.js`)

Standardized error messages:

```javascript
export const MESSAGES = {
  AUTH: {
    TOKEN_MISSING: "Invalid or expired token",
    TOKEN_INVALID: "Invalid token",
  },
  SOCKET: {
    TO_USER_REQUIRED: "toUserId is required",
    MESSAGE_EMPTY: "message cannot be empty",
    SOMETHING_WENT_WRONG: "Something went wrong",
  },
};

export const SOCKET_EVENTS = {
  ONLINE_USERS: "online_users",
  PRIVATE_MESSAGE: "private_message",
  MESSAGE_SENT: "message_sent",
  USER_OFFLINE: "user_offline",
  ERROR_MESSAGE: "error_message",
};
```

---

### 5. Event Handlers (`src/socket/socket.event.js`)

Manages real-time messaging using centralized constants from `src/constant/response.messages.js`:

**Features:**
- Tracks online users in in-memory Map
- Broadcasts online user list to all clients
- Routes private messages between authenticated users
- Validates message format and sender/receiver using `MESSAGES` constants
- Handles disconnection cleanup
- Uses `SOCKET_EVENTS` constants for event names

**Message Flow:**
1. User connects → Added to online users Map
2. Online users list broadcasted via `SOCKET_EVENTS.ONLINE_USERS` event
3. Sender emits `SOCKET_EVENTS.PRIVATE_MESSAGE` event
4. System validates message using `MESSAGES.SOCKET` constants
5. If receiver online → Message routed to receiver socket
6. Confirmation sent back to sender via `SOCKET_EVENTS.MESSAGE_SENT`
7. If receiver offline → Error sent via `SOCKET_EVENTS.USER_OFFLINE`
8. On disconnect → User removed from Map, online users list updated

**Error Handling:**
- `MESSAGES.SOCKET.TO_USER_REQUIRED` - When toUserId is missing
- `MESSAGES.SOCKET.MESSAGE_EMPTY` - When message is empty or whitespace
- `MESSAGES.SOCKET.SOMETHING_WENT_WRONG` - For unexpected errors
- `MESSAGES.AUTH.TOKEN_INVALID` - For authentication failures

**Usage Example:**
```javascript
import { SOCKET_EVENTS, MESSAGES } from '../constant/response.messages.js';

// Event validation uses MESSAGES constants
if (!toUserId) {
  socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
    message: MESSAGES.SOCKET.TO_USER_REQUIRED 
  });
}

if (!message?.trim()) {
  socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
    message: MESSAGES.SOCKET.MESSAGE_EMPTY 
  });
}
```

---

## Environment Variables

Required in `.env`:

```
CLIENT_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
```

---

## Frontend Integration Example

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
    auth: {
        token: localStorage.getItem('token')
    }
});

// Listen for online users
socket.on('online_users', (users) => {
    console.log('Online users:', users);
});

// Send private message
socket.emit('private_message', {
    toUserId: 'user123',
    message: 'Hello!'
});

// Receive message
socket.on('private_message', (data) => {
    console.log(`${data.fromUserId}: ${data.message}`);
});

// Handle errors
socket.on('error_message', (data) => {
    console.error(data.message);
});
```

---

## Testing with Thunderclient

1. **Connect:** Create WebSocket connection with Bearer token in auth
2. **Send Message:** Emit `private_message` event with payload
3. **Monitor:** Listen to incoming events on connected socket

---

## Current Limitations (Development)

- ⚠️ In-memory storage (lost on server restart)
- ⚠️ Single server only (no scaling)
- ⚠️ No message persistence

---

## Future Improvements

- [ ] Redis for distributed online user tracking
- [ ] MongoDB for message persistence
- [ ] Typing indicator events
- [ ] Read receipts
- [ ] Message history on connect
- [ ] Chat room/namespace support
- [ ] File sharing capability

---

## Troubleshooting

**Connection refused:**
- Verify server is running on correct port
- Check CORS origin in `.env`

**Token invalid:**
- Ensure valid JWT in auth payload
- Check JWT_SECRET matches between auth and socket

**Messages not delivering:**
- Verify receiver is in online users list
- Check socket IDs are correctly mapped

**Last Updated:** January 15, 2026