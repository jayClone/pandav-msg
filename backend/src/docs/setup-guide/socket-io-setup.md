# Socket.IO Setup Guide

## Overview
This guide explains how we set up Socket.IO for real-time messaging with JWT authentication in the Pandav MSG application.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │◄────────┤  Socket.IO   │────────►│  Server     │
│  (Browser)  │  WebSocket Connection  │         │  (Node.js)  │
└─────────────┘         └──────────────┘         └─────────────┘
```

---

## Installation

### Step 1: Install Dependencies

```bash
cd backend
npm install socket.io
# or
bun add socket.io
```

### Step 2: Verify Installation

Check `package.json`:
```json
{
  "dependencies": {
    "socket.io": "^4.x.x"
  }
}
```

---

## Implementation

### 1. Server Setup (`src/server.js`)

The main entry point that creates HTTP server and attaches Socket.IO:

```javascript
import http from 'http';
import app from "./app";
import { createSocketServer } from './socket/socket.server.js';

const PORT = process.env.PORT || 5000;

// Create HTTP server from Express app
const httpServer = http.createServer(app);

// Attach Socket.IO to same server
createSocketServer(httpServer);

// Start server (use httpServer, not app)
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Important:** Use `httpServer.listen()` instead of `app.listen()` to support WebSocket connections!

---

### 2. Socket Server Configuration (`src/socket/socket.server.js`)

Creates and configures Socket.IO instance with CORS settings:

```javascript
import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketEvents } from './socket.event.js';

export function createSocketServer(httpServer) {
    // Create Socket.IO server attached to HTTP server
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL,  // Allow frontend to connect
            credentials: true
        }
    });

    // Apply JWT middleware for authentication
    io.use(socketAuthMiddleware);

    // Listen for new connections
    io.on("connection", (socket) => {
        registerSocketEvents(io, socket);
    });

    console.log("[SOCKET] Socket.io Initialized");
    return io;
}
```

**What it does:**
- Creates Socket.IO server attached to HTTP server
- Enables CORS to allow frontend connections
- Applies authentication middleware
- Registers event handlers for each connection

---

### 3. Authentication Middleware (`src/socket/socket.auth.js`)

Validates JWT tokens before allowing socket connection:

```javascript
import jwt from 'jsonwebtoken';

export function socketAuthMiddleware(socket, next) {
    try {
        // Token sources (in order of priority):
        // 1. socket.handshake.auth.token (recommended)
        // 2. Authorization header: Bearer xxx
        
        const tokenFromAuth = socket.handshake?.auth?.token;
        const authHeader = socket.handshake?.header?.authorization;

        let token = tokenFromAuth;

        // Extract token from Bearer header if not in auth
        if (!token && authHeader?.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (!token) {
            return next(new Error("AUTH_ERROR : Token is missing"));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user info to socket for later use
        socket.user = {
            userId: decoded.id,
            email: decoded.email
        };

        return next();
    } catch (error) {
        return next(new Error("AUTH_ERROR : Invalid token"));
    }
}
```

**What it does:**
- Extracts JWT from connection handshake
- Verifies token validity
- Blocks unauthenticated connections
- Attaches user data to socket object

---

### 4. Event Handlers (`src/socket/socket.event.js`)

Manages real-time events like online status and messaging:

```javascript
const onlineUsers = new Map();  // userId -> socketId

export function registerSocketEvents(io, socket) {
    const { userId, email } = socket.user;

    // 1. Mark user as online
    onlineUsers.set(userId, socket.id);
    
    // 2. Broadcast online users to all clients
    io.emit("online_users", Array.from(onlineUsers.keys()));
    console.log(`[SOCKET] Connected: ${email} (${userId}) -> ${socket.id}`);

    // 3. Handle incoming private messages
    socket.on("private_message", (payload) => {
        try {
            const { toUserId, message } = payload || {};

            // Validation
            if (!toUserId || typeof toUserId !== "string") {
                socket.emit("error_message", { message: "toUserId is required" });
                return;
            }
            if (!message || typeof message !== "string" || message.trim().length === 0) {
                socket.emit("error_message", { message: "message cannot be empty" });
                return;
            }

            const receiverSocketId = onlineUsers.get(toUserId);

            // Check if receiver is online
            if (!receiverSocketId) {
                socket.emit("user_offline", { toUserId });
                return;
            }

            // Send message to receiver only
            io.to(receiverSocketId).emit("private_message", {
                fromUserId: userId,
                message: message.trim(),
                time: new Date().toISOString(),
            });

            // Confirm to sender
            socket.emit("message_sent", {
                toUserId,
                message: message.trim(),
                time: new Date().toISOString(),
            });
        } catch (error) {
            socket.emit("error_message", { message: "Something went wrong" });
        }
    });

    // 4. Handle disconnection
    socket.on("disconnect", () => {
        onlineUsers.delete(userId);
        io.emit("online_users", Array.from(onlineUsers.keys()));
        console.log(`[SOCKET] Disconnected: ${email} (${userId})`);
    });
}
```

**What it does:**
- Tracks online users in a Map
- Broadcasts online user list to all clients
- Handles private message routing
- Validates message format
- Checks if receiver is online
- Cleans up on disconnect

---

## Message Flow

```
CLIENT                          SERVER
  │                              │
  ├─ Connect with JWT ─────────►│
  │                              │ (Verify token)
  │◄─ Connection accepted ──────┤
  │                              │
  ├─ Send message ─────────────►│
  │  {toUserId, message}         │ (Validate & route)
  │                              ├─► Send to receiver
  │                              │
  │◄─ Message delivered ────────┤
  │                              │
  └─ Disconnect ───────────────►│
                                 │ (Clean up)
```

---

## Environment Variables

Add to `.env`:

```
PORT=5000
CLIENT_URL=http://localhost:3000
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
MONGO_URI=mongodb://localhost:27017/<name>
```

---

## Frontend Implementation

### Install Socket.IO Client

```bash
cd frontend
npm install socket.io-client
```

### Example Usage in React

```javascript
import io from 'socket.io-client';
import { useEffect, useState } from 'react';

export function Chat() {
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);

    useEffect(() => {
        // Connect with JWT token
        const newSocket = io('http://localhost:5000', {
            auth: {
                token: localStorage.getItem('token')  // Send JWT
            }
        });

        // Listen for online users
        newSocket.on('online_users', (users) => {
            setOnlineUsers(users);
        });

        // Listen for incoming messages
        newSocket.on('private_message', (data) => {
            console.log(`Message from ${data.fromUserId}:`, data.message);
        });

        setSocket(newSocket);

        return () => newSocket.close();
    }, []);

    const sendMessage = (toUserId, message) => {
        socket?.emit('private_message', {
            toUserId,
            message
        });
    };

    return (
        <div>
            <h2>Online Users: {onlineUsers.length}</h2>
            <button onClick={() => sendMessage('userId123', 'Hello!')}>
                Send Message
            </button>
        </div>
    );
}
```

---

## Testing Socket.IO

### Using Thunder Client or Postman

1. Connect to WebSocket: `ws://localhost:5000/socket.io/?token=<your_jwt_token>`
2. Send test events
3. Monitor real-time responses

### Using Socket.IO Dev Tools

Install extension or use browser DevTools to monitor socket events.

---

## Common Issues & Solutions

### Issue: Connection Refused
**Solution:** Ensure server is running with `bun run dev` or `npm run dev`

### Issue: JWT Token Invalid
**Solution:** Verify token in localStorage and check JWT_SECRET in .env

### Issue: CORS Error
**Solution:** Check CLIENT_URL in .env matches your frontend origin

### Issue: Messages Not Delivering
**Solution:** Verify receiverSocketId exists in onlineUsers Map

---

## Key Takeaways

✅ **Security**: JWT authentication on every connection
✅ **Real-time**: WebSocket bidirectional communication
✅ **Scalability**: In-memory Map (upgrade to Redis for production)
✅ **Error Handling**: Proper validation before routing messages
✅ **Clean Code**: Separation of concerns (auth, events, server)

---

## Next Steps (Future Improvements)

1. **Persistent Storage**: Store messages in MongoDB
2. **Redis Integration**: Replace in-memory Map for distributed systems
3. **Message History**: Query past conversations on connect
4. **Typing Indicators**: Real-time "typing..." status
5. **Read Receipts**: Track message delivery & read status
6. **Group Chats**: Implement room-based messaging
7. **File Sharing**: Support image/file transfers

---

**Last Updated:** January 15, 2026