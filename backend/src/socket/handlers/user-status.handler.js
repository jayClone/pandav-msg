import { SOCKET_EVENTS } from "@constants/response.messages.js";
import User from "@models/User.js";

/**
 * Handle user connect
 */
export async function handleUserConnect(socket, io, userId, email, name, onlineUsers) {
    console.log(`[SOCKET] User connected: ${name} (${userId})`);

    // Set user online in db
    await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: Date.now()
    }).catch(err => console.error('Failed to update user online status:', err));

    // Store user in online users map
    onlineUsers.set(userId, {
        socketId: socket.id,
        name: name,
        email: email,
        userId: userId
    });
    
    // Broadcast updated online users list
    broadcastOnlineUsers(io, onlineUsers);
    console.log(`[SOCKET] Connected: ${name} (${userId}) -> ${socket.id}`);
}

/**
 * Handle user disconnect
 */
export async function handleUserDisconnect(socket, io, userId, name, onlineUsers) {
    onlineUsers.delete(userId);
    
    // Set user offline in DB
    await User.findByIdAndUpdate(userId, { 
        isOnline: false,
        lastSeen: Date.now()
    }).catch(err => console.error('Failed to update user offline status:', err));
    
    broadcastOnlineUsers(io, onlineUsers);
    console.log(`[SOCKET] Disconnected: ${name} (${userId})`);
}

/**
 * Helper: Broadcast online users to all connected clients
 */
function broadcastOnlineUsers(io, onlineUsers) {
    const onlineUsersList = Array.from(onlineUsers.values()).map(user => ({
        userId: user.userId,
        name: user.name,
        email: user.email,
        status: 'online'
    }));
    io.emit(SOCKET_EVENTS.ONLINE_USERS, onlineUsersList);
    console.log(`[BROADCAST] Online users: ${onlineUsersList.length}`);
}