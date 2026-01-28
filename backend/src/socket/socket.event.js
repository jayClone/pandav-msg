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

    // User connected
    handleUserConnect(socket, io, userId, email, name, onlineUsers);

    //  Private message event
    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, async (data, callback) => {
        console.log("📥 [SOCKET] Received PRIVATE_MESSAGE:", { 
            toUserId: data.toUserId, 
            uniqueId: data.uniqueId 
        });
        
        try {
            const result = await handlePrivateMessage(socket, io, data, userId, name, onlineUsers);
            
            // Send acknowledgment back to sender with message details
            if (callback && typeof callback === 'function') {
                callback(null, {
                    success: true,
                    _id: result?._id,
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

    // ✅ JOIN GROUP EVENT
    socket.on(SOCKET_EVENTS.JOIN_GROUP, async (payload) => {
        console.log("📥 [SOCKET] Received JOIN_GROUP");
        handleJoinGroup(socket, io, payload, userId, name);
    });

    // ✅ LEAVE GROUP EVENT
    socket.on(SOCKET_EVENTS.LEAVE_GROUP, async (payload) => {
        console.log("📥 [SOCKET] Received LEAVE_GROUP");
        handleLeaveGroup(socket, io, payload, userId, name);
    });

    // ✅ GROUP MESSAGE EVENT
    socket.on(SOCKET_EVENTS.GROUP_MESSAGE, async (payload) => {
        console.log("📥 [SOCKET] Received GROUP_MESSAGE");
        handleGroupMessage(socket, io, payload, userId, name);
    });

    // ✅ TYPING EVENT
    socket.on(SOCKET_EVENTS.TYPING, (data) => {
        console.log("📥 [SOCKET] Received TYPING:", { toUserId: data.toUserId, isTyping: data.isTyping });
        const receiverUser = onlineUsers.get(data.toUserId);
        
        if (receiverUser) {
            console.log(`📤 [SOCKET] Sending TYPING to ${receiverUser.name}`);
            io.to(receiverUser.socketId).emit(SOCKET_EVENTS.TYPING, {
                fromUserId: userId,
                isTyping: data.isTyping
            });
        }
    });

    // ✅ MESSAGE DELETED EVENT
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, (data) => {
        console.log("📥 [SOCKET] Received MESSAGE_DELETED:", data);
        
        const receiverUser = onlineUsers.get(data.toUserId);
        
        if (receiverUser) {
            console.log(`📤 [SOCKET] Sending MESSAGE_DELETED to ${receiverUser.name}`);
            io.to(receiverUser.socketId).emit(SOCKET_EVENTS.MESSAGE_DELETED, {
                messageId: data.messageId,
                fromUserId: userId,
                toUserId: data.toUserId
            });
        } else {
            console.log(`⚠️ [SOCKET] Receiver ${data.toUserId} offline`);
        }
    });

    //  Read receipt event
    socket.on(SOCKET_EVENTS.READ_RECEIPT, async (data) => {
        console.log("📥 [READ_RECEIPT] Received:", data);

        const { messageId, senderId, receiverId } = data;
        
        try {
            // ✅ Update message in DB as read
            const updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { read: true },
                { new: true }
            );
            console.log(`✅ [DB] Message ${messageId} marked as read in database`);

            // ✅ Find ORIGINAL SENDER (who sent the message)
            const originalSender = onlineUsers.get(senderId);
            console.log(`📥 [READ_RECEIPT] Looking for sender ${senderId}:`, originalSender ? "FOUND" : "NOT FOUND");
            
            if (originalSender) {
                // ✅ Send read receipt back to sender ONLY if online
                io.to(originalSender.socketId).emit(SOCKET_EVENTS.MESSAGE_READ, {
                    messageId: messageId,
                    readBy: userId,  // Who read it
                    senderId: senderId,
                    readerName: name
                });
                console.log(`✅ [SOCKET] MESSAGE_READ sent to sender ${originalSender.name}`);
            } else {
                console.log(`⚠️ [READ_RECEIPT] Sender ${senderId} is offline, message saved as read in DB`);
            }
        } catch (err) {
            console.error(`❌ [ERROR] Failed to mark message as read:`, err.message);
        }
    });

    // ✅ USER DISCONNECTED
    socket.on("disconnect", async () => {
        handleUserDisconnect(socket, io, userId, name, onlineUsers);
    });
}