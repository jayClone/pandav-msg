import { MESSAGES, SOCKET_EVENTS } from "@constants/response.messages.js";
import Message from '@models/Message.js';

/**
 * Handle private messages
 */
export async function handlePrivateMessage(socket, io, data, userId, name, onlineUsers) {
    const { toUserId, message } = data;

    try {
        // Validation Layer
        if (!toUserId || typeof toUserId !== "string") {
            throw new Error("toUserId is required");
        }
        
        if (!message || typeof message !== "string" || message.trim().length === 0) {
            throw new Error("message cannot be empty");
        }

        const trimmedMessage = message.trim();
        const receiverUser = onlineUsers.get(toUserId);

        // Save message to DB
        let savedMessage;
        try {
            savedMessage = await Message.create({
                senderId: userId,
                receiverId: toUserId,
                message: trimmedMessage,
                chatType: 'private'
            });
            console.log(`[DB] Message saved: ${savedMessage._id}`);
        } catch (dbError) {
            console.error('[DB ERROR] Failed to save message:', dbError.message);
            throw new Error('Failed to save message');
        }

        const messagePayload = {
            _id: savedMessage._id,
            fromUserId: userId,
            toUserId: toUserId,
            fromUserName: name,
            message: trimmedMessage,
            time: savedMessage.createdAt.toISOString(),
            delivered: false
        };

        // If receiver is online: send real-time notification
        if (receiverUser) {
            io.to(receiverUser.socketId).emit('private_message', {
                ...messagePayload,
                delivered: true
            });
            console.log(`[MSG-LIVE] ${name} → ${receiverUser.name}: ${trimmedMessage.substring(0, 30)}...`);
        }
        else {
            // If receiver is OFFLINE: Still saved in DB
            console.log(`[MSG-QUEUED] ${name} → ${toUserId} (offline): ${trimmedMessage.substring(0, 30)}...`);
        }

        console.log(`[CONFIRM] Message confirmed for ${name}`);
        
        // Return the saved message for callback
        return {
            _id: savedMessage._id,
            delivered: !!receiverUser,
            saved: true
        };

    } catch (error) {
        console.error('[ERROR] Message sending failed:', error.message);
        throw error;
    }
}