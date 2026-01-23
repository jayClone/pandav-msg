import { SOCKET_EVENTS } from "@constants/response.messages.js";
import { handlePrivateMessage } from './handlers/private-message.handler.js';
import { handleJoinGroup, handleLeaveGroup } from './handlers/group-room.handler.js';
import { handleGroupMessage } from './handlers/group-message.handler.js';
import { handleUserConnect, handleUserDisconnect } from './handlers/user-status.handler.js';

const onlineUsers = new Map();

/**
 * Register all socket events
 * Handlers: messaging, online status, disconnection
 */
export function registerSocketEvents(io, socket) {
    const { userId, email, name } = socket.user;

    //  User connected
    handleUserConnect(socket, io, userId, email, name, onlineUsers);

    //  Private message event
    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, async (data) => {
        handlePrivateMessage(socket, io, data, userId, name, onlineUsers);
    });

    //  Join group event
    socket.on('join_group', async (payload) => {
        handleJoinGroup(socket, io, payload, userId, name);
    });

    //  Leave group event
    socket.on('leave_group', async (payload) => {
        handleLeaveGroup(socket, io, payload, userId, name);
    });

    //  Group message event
    socket.on('group_message', async (payload) => {
        handleGroupMessage(socket, io, payload, userId, name);
    });

    //  Message deleted event
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, (data) => {
        console.log("📥 [SOCKET] Received MESSAGE_DELETED event:", data);
        console.log("📥 [SOCKET] Current userId:", userId);
        console.log("📥 [SOCKET] Online users map:", Array.from(onlineUsers.entries()));
        
        const receiverUser = onlineUsers.get(data.toUserId);
        console.log("📥 [SOCKET] Receiver user found:", receiverUser);
        
        if (receiverUser) {
            console.log(`📤 [SOCKET] Sending to receiver ${receiverUser.name} (socket: ${receiverUser.socketId})`);
            io.to(receiverUser.socketId).emit(SOCKET_EVENTS.MESSAGE_DELETED, {
                messageId: data.messageId,
                fromUserId: userId,
                toUserId: data.toUserId
            });
        } else {
            console.log(`⚠️ [SOCKET] Receiver ${data.toUserId} NOT found in online users`);
        }
    });

    //  User disconnected
    socket.on("disconnect", async () => {
        handleUserDisconnect(socket, io, userId, name, onlineUsers);
    });
}