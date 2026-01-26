import { SOCKET_EVENTS } from "@constants/response.messages.js";
import { handlePrivateMessage } from './handlers/private-message.handler.js';
import { handleJoinGroup, handleLeaveGroup } from './handlers/group-room.handler.js';
import { handleGroupMessage } from './handlers/group-message.handler.js';
import { handleUserConnect, handleUserDisconnect } from './handlers/user-status.handler.js';
import Message from '@models/Message.js';

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
    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, async (data, callback) => {
        console.log("📥 [SOCKET] Received PRIVATE_MESSAGE:", { toUserId: data.toUserId, tempId: data.tempId, uniqueId: data.uniqueId });
        
        try {
            const result = await handlePrivateMessage(socket, io, data, userId, name, onlineUsers);
            
            // Send acknowledgment back to sender with message details
            if (callback && typeof callback === 'function') {
                callback(null, {
                    success: true,
                    _id: result?._id,
                    tempId: data.tempId,
                    uniqueId: data.uniqueId,
                    delivered: result?.delivered || true,
                    message: "Message sent successfully"
                });
            }
        } catch (error) {
            console.error("❌ [SOCKET] Error handling private message:", error.message);
            if (callback && typeof callback === 'function') {
                callback(error.message);
            }
        }
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

    //  Typing event
    socket.on(SOCKET_EVENTS.TYPING, (data) => {
        console.log("📥 [SOCKET] Received TYPING event:", { toUserId: data.toUserId, isTyping: data.isTyping });
        const receiverUser = onlineUsers.get(data.toUserId);
        
        if (receiverUser) {
            console.log(`📤 [SOCKET] Sending typing notification to ${receiverUser.name}`);
            io.to(receiverUser.socketId).emit(SOCKET_EVENTS.TYPING, {
                fromUserId: userId,
                isTyping: data.isTyping
            });
        }
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

    //  Read receipt event
    socket.on(SOCKET_EVENTS.READ_RECEIPT, async (data) => {
        console.log("📥 [SOCKET] Received READ_RECEIPT event:", data);
        console.log("📥 [SOCKET] Current userId (message sender):", userId);
        console.log("📥 [SOCKET] Looking for user in onlineUsers:", Array.from(onlineUsers.keys()));
        
        // The sender of the original message is the current user (userId)
        const senderUser = onlineUsers.get(userId);
        console.log("📥 [SOCKET] Sender user found:", senderUser?.name);
        
        try {
            // Update message as read in database
            const updatedMessage = await Message.findByIdAndUpdate(
                data.messageId,
                { read: true },
                { new: true }
            );
            console.log(`✅ [DB] Message ${data.messageId} marked as read in database`, updatedMessage);
        } catch (err) {
            console.error(`❌ [DB ERROR] Failed to mark message as read:`, err.message);
        }
        
        if (senderUser) {
            console.log(`📤 [SOCKET] Sending MESSAGE_READ to ${senderUser.name} (socket: ${senderUser.socketId})`);
            io.to(senderUser.socketId).emit(SOCKET_EVENTS.MESSAGE_READ, {
                messageId: data.messageId,
                readBy: userId
            });
            console.log(`✅ [SOCKET] MESSAGE_READ event sent`);
        } else {
            console.log(`⚠️ [SOCKET] Sender (${userId}) NOT found in online users, message may not be delivered`);
        }
    });

    //  User disconnected
    socket.on("disconnect", async () => {
        handleUserDisconnect(socket, io, userId, name, onlineUsers);
    });
}