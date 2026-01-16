import { MESSAGES, SOCKET_EVENTS } from "../constant/response.messages.js";

const onlineUsers = new Map();

export function registerSocketEvents(io, socket){
    const { userId, email, name } = socket.user;

    // Store full user object
    onlineUsers.set(userId, {
        socketId: socket.id,
        name: name,
        email: email,
        userId: userId
    });
    
    // Broadcast online users
    const onlineUsersList = Array.from(onlineUsers.values()).map(user => ({
        userId: user.userId,
        name: user.name,
        email: user.email
    }));
    io.emit(SOCKET_EVENTS.ONLINE_USERS, onlineUsersList);

    console.log(`[SOCKET] Connected: ${name} (${userId}) -> ${socket.id}`);

    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, (payload) => {
        try {
            const { toUserId, message } = payload || {};

            if (!toUserId || typeof toUserId !== "string") {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: MESSAGES.SOCKET.TO_USER_REQUIRED 
                });
                return;
            }
            
            if (!message || typeof message !== "string" || message.trim().length === 0) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: MESSAGES.SOCKET.MESSAGE_EMPTY 
                });
                return;
            }

            const receiverUser = onlineUsers.get(toUserId);
            const messagePayload = {
                fromUserId: userId,
                fromUserName: name,
                message: message.trim(),
                time: new Date().toISOString(),
            };

            // If receiver is offline
            if (!receiverUser) {
                socket.emit(SOCKET_EVENTS.USER_OFFLINE, { toUserId });
                return;
            }

            // Send to receiver
            io.to(receiverUser.socketId).emit(SOCKET_EVENTS.PRIVATE_MESSAGE, messagePayload);

            // ✅ IMPORTANT: Also send back to sender (so they see their own message)
            socket.emit(SOCKET_EVENTS.MESSAGE_SENT, {
                toUserId,
                toUserName: receiverUser.name,
                message: message.trim(),
                time: messagePayload.time,
            });

            console.log(`[MSG] ${name} → ${receiverUser.name}: ${message.substring(0, 30)}...`);

        } catch (error) {
            console.error('[ERROR] Message sending failed:', error.message);
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: MESSAGES.SOCKET.SOMETHING_WENT_WRONG 
            });
        }
    });

    socket.on("disconnect", () => {
        onlineUsers.delete(userId);

        const onlineUsersList = Array.from(onlineUsers.values()).map(user => ({
            userId: user.userId,
            name: user.name,
            email: user.email
        }));
        io.emit(SOCKET_EVENTS.ONLINE_USERS, onlineUsersList);

        console.log(`[SOCKET] Disconnected: ${name} (${userId})`);
    });
}