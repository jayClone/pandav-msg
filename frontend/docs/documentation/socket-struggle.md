# Socket.IO Setup Journey - Challenges & Solutions

## Overview
This document chronicles the complete Socket.IO implementation for real-time messaging in Pandav MSG, including all challenges faced and their solutions.

---

## Part 1: Initial Setup

### Backend Installation

```bash
cd backend
npm install socket.io
# or
bun add socket.io
```

### Frontend Installation

```bash
cd frontend
npm install socket.io-client jwt-decode
# or
bun add socket.io-client jwt-decode
```

---

## Part 2: Architecture Implementation

### Backend Structure

**Server Setup** (`backend/src/server.js`)
- Must use `http.createServer()` instead of `app.listen()`
- Socket.IO attaches to HTTP server
- Must load `.env` with `dotenv.config()` at the top

```javascript
import dotenv from 'dotenv';
dotenv.config();  // ✅ CRITICAL: Must be first

import http from 'http'
import app from "./app";
import { createSocketServer } from './socket/socket.server.js';

const httpServer = http.createServer(app)
createSocketServer(httpServer);
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Socket Server** (`backend/src/socket/socket.server.js`)
- Creates Socket.IO server with CORS configuration
- Applies JWT authentication middleware
- Registers socket event handlers

**Authentication Middleware** (`backend/src/socket/socket.auth.js`)
- Validates JWT tokens on connection
- Extracts token from `socket.handshake.auth.token`
- Falls back to `Authorization: Bearer <token>` header
- Attaches user data to socket object

**Event Handlers** (`backend/src/socket/socket.event.js`)
- Maintains online users Map
- Handles private message routing
- Broadcasts online user list
- Validates message payload

### Frontend Structure

**Socket Client** (`frontend/src/socket/socketClient.js`)
- Creates Socket.IO client instance
- Manages socket lifecycle
- Handles connection/disconnection

**Chat Component** (`frontend/src/pages/Chat.jsx`)
- Connects socket on component mount
- Listens to socket events
- Updates UI based on socket data

---

## Part 3: Challenges & Solutions

### Challenge 1: CORS Error (HTTP 400)

**Error Message:**
```
Access to XMLHttpRequest at 'http://localhost:5000/socket.io/?EIO=4&transport=polling' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
The 'Access-Control-Allow-Origin' header has a value 'http://localhost:3000' 
that is not equal to the supplied origin.
```

**Root Cause:**
- Frontend running on `http://localhost:5173` (Vite default)
- Backend CORS hardcoded to `http://localhost:3000` (old port)
- Socket.IO uses polling transport which requires CORS headers

**Solution:**
Update `socket.server.js` with dynamic CORS origin:

```javascript
const getOrigin = () => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
        return ['http://localhost:3000', 'http://localhost:5173'];
    }
    return process.env.CLIENT_URL;
};

const io = new Server(httpServer, {
    cors: {
        origin: getOrigin(),  // ✅ Dynamic
        credentials: true
    }
});
```

Update `.env`:
```
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

**Lesson:** Always match frontend and backend ports in development CORS configuration.

---

### Challenge 2: Token Verification Failed

**Error Message:**
```
🔴 Socket connection error: AUTH_ERROR : Invalid or expired token
```

**Root Causes:**
1. `JWT_SECRET` not loaded in backend
2. Token payload missing `name` field
3. Frontend sending old token after login

**Solutions:**

**2A: Ensure JWT_SECRET is loaded**
```javascript
// server.js
console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'NOT SET');
```

**2B: Include name in JWT payload**
```javascript
// authController.js
const generateToken = (user) => {
    return jwt.sign({
        userId: user._id.toString(),
        email: user.email,
        name: user.name  // ✅ CRITICAL
    }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};
```

**2C: Disconnect old socket on new login**
```javascript
// socketClient.js
export const connectSocket = (token) => {
    if (socket) {
        console.log('🔄 Disconnecting old socket...');
        socket.disconnect();
        socket = null;
    }
    // ... create new socket with new token
};
```

**Lesson:** JWT payload must match what backend expects. Always disconnect old connections before creating new ones.

---

### Challenge 3: React Hooks setState in Effect

**Error Message:**
```
Error: Calling setState synchronously within an effect can trigger cascading renders
```

**Root Cause:**
Multiple `setState` calls in useEffect body:
```javascript
useEffect(() => {
    setCurrentUserName(decoded.name);  // First render
    setUserNames({...});               // Second render
}, [token]);
```

**Solution:**
Move decoding to `useMemo` outside effect:

```javascript
const authState = useMemo(() => {
    if (!token) return { currentUserName: "", currentUserId: "" };
    
    try {
        const decoded = jwtDecode(token);
        return {
            currentUserName: decoded.name,
            currentUserId: decoded.userId,
        };
    } catch (error) {
        console.error("Invalid token:", error);
        return { currentUserName: "", currentUserId: "" };
    }
}, [token]);

const { currentUserName, currentUserId } = authState;
```

**Lesson:** Use `useMemo` for computations, `useEffect` only for side effects.

---

### Challenge 4: Missing "key" Prop in List

**Error Message:**
```
Each child in a list should have a unique "key" prop.
```

**Root Cause:**
```javascript
messages.map((m, index) => (
    <div>  // ❌ No key prop
```

**Solution:**
```javascript
messages.map((m, index) => (
    <div key={index}>  // ✅ Add key
```

**Note:** Using index is temporary. For production, use unique message IDs from database.

**Lesson:** Always provide stable, unique keys in list renders.

---

### Challenge 5: Messages Not Showing on Both Clients

**Problem:**
- User A sends message → User B sees it ✅
- User B sends message → User A sees it ✅
- But User A doesn't see their own sent message until User B replies ❌

**Root Cause:**
Backend only sent message to receiver, not back to sender:
```javascript
// ❌ OLD CODE
io.to(receiverUser.socketId).emit(SOCKET_EVENTS.PRIVATE_MESSAGE, messagePayload);
// Sender doesn't get confirmation
```

**Solution:**
Send confirmation back to sender:
```javascript
// ✅ NEW CODE
io.to(receiverUser.socketId).emit(SOCKET_EVENTS.PRIVATE_MESSAGE, messagePayload);

socket.emit(SOCKET_EVENTS.MESSAGE_SENT, {
    toUserId,
    toUserName: receiverUser.name,
    message: message.trim(),
    time: messagePayload.time,
});
```

Frontend handles both events:
```javascript
const handlePrivateMessage = (data) => {
    // Messages from other users
    setMessages(prev => [...prev, {
        fromUserId: data.fromUserId,
        toUserId: "me",
        ...data
    }]);
};

const handleMessageSent = (data) => {
    // My own messages
    setMessages(prev => [...prev, {
        fromUserId: currentUserId,
        toUserId: data.toUserId,
        ...data
    }]);
};
```

**Lesson:** Always send confirmation back to sender in chat applications.

---

## Part 4: Final Message Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User A (Chrome)              Socket.IO Server      User B (Incognito)
├─────────────────────────────────────────────────────────────┤
│ 1. Login with token                                         │
│    ├─ JWT generated with name field                         │
│    └─ connectSocket(token)                                  │
│                                                              │
│ 2. Socket connects with JWT auth ───────────────────────→ │
│                                           ✅ Token verified  │
│                                           Store in Map       │
│                                           Broadcast online   │
│                            ←──── online_users event ────     │
│    Show User B in list                                  Show User A in list
│                                                              │
│ 3. User A selects User B and types message                  │
│    ├─ Click Send                                            │
│    └─ emit('private_message', {toUserId, message})         │
│                                 ──→ Validate message        │
│                                 ──→ Find receiver in Map     │
│                                 ──→ Send to receiver        │
│                            ←──── private_message ────────→ │
│    Show own message in chat                         Show message from User A
│ ←──── message_sent ─────                                     │
│    (Confirmation)                                           │
│                                                              │
│ 4. User B replies                                           │
│    └─ emit('private_message', {toUserId, message})         │
│                                 ──→ Validate & route       │
│ ←──── private_message ─────────────────────────────────── │
│    Show message from User B                    Show own message
│                            ←──── message_sent ────          │
│                                (Confirmation)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 5: Key Takeaways

### Backend Requirements
✅ Use HTTP server, not Express app directly  
✅ Load `.env` before importing anything  
✅ Include all user fields in JWT (name, userId, email)  
✅ Send message_sent confirmation back to sender  
✅ Validate message payload thoroughly  
✅ Maintain online users Map for routing  

### Frontend Requirements
✅ Disconnect old socket before creating new one  
✅ Use `useMemo` for token decoding, not `useState` in effect  
✅ Provide unique `key` props in list renders  
✅ Handle both `private_message` and `message_sent` events  
✅ Store auth state outside effects  

### CORS Configuration
✅ Match frontend port in CORS origin  
✅ Use dynamic origin for development  
✅ Test with both HTTP and HTTPS in production  

### Testing Approach
✅ Log all socket events in console  
✅ Verify token is sent and received  
✅ Check Network tab for WebSocket connection  
✅ Monitor backend console for routing logs  

---

## Part 6: Current Status

✅ Socket.IO successfully connected with JWT auth  
✅ Online users list broadcasting working  
✅ Private message routing functioning  
✅ Message displayed on both clients  
✅ User names showing correctly  
✅ Error handling and validation in place  

**Next Steps:**
- [ ] Persist messages to MongoDB
- [ ] Add message history on reconnect
- [ ] Implement typing indicators
- [ ] Add read receipts
- [ ] Support for chat rooms/namespaces
- [ ] File sharing capability

---

## Debugging Commands

**Check Socket Connection (Frontend Console):**
```javascript
const socket = getSocket();
console.log('Socket ID:', socket?.id);
console.log('Connected:', socket?.connected);
```

**Monitor Events (Backend Console):**
```javascript
socket.on('private_message', (data) => {
    console.log('[MSG]', data);
});
```

**Test with cURL (Backend):**
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Last Updated:** January 16, 2026  
**Status:** ✅ Working - Ready for production migration