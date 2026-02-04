import { MESSAGES, SOCKET_EVENTS } from "@constants/response.messages.js";
import Friend from "app/models/Friend";
import Message from '@models/Message.js';

/**
 * Handle private messages
 */
export async function handlePrivateMessage(socket, io, payload, userId, name, onlineUsers) {
    const { toUserId, message, uniqueId} = payload;

    try {
        // Validation Layer
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

        const trimmedMessage = message.trim();
        const receiverUser = onlineUsers.get(toUserId);

        // friends validation
        console.log(`[FRIEND-CHECK] varifying friendship between ${userId} and ${toUserId}`);

        const areFriends = await Friend.findOne({
            $or: [
                {senderId: userId, receiverId: toUserId, status: 'accepted' },
                {senderId: toUserId, receiverId: userId, status: 'accepted' },
            ]
        });

        if (!areFriends) {
            console.warn(`⚠️ [BLOCKED] Non-friend message attempt: ${userId} → ${toUserId}`)
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: MESSAGES.FRIEND.CANNOT_MESSAGE 
            });
            return;
        }
        console.log(`✅ [FRIEND-CHECK] Users are friends, proceeding...`);


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
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: 'Failed to save message'
            });
            return;
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
            io.to(receiverUser.socketId).emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
                ...messagePayload,
                delivered: true
            });
            console.log(`[MSG-LIVE] ${name} → ${receiverUser.name}: ${trimmedMessage.substring(0, 30)}...`);
        }
        else {
            // If receiver is OFFLINE: Still saved in DB
            console.log(`[MSG-QUEUED] ${name} → ${toUserId} (offline): ${trimmedMessage.substring(0, 30)}...`);
            
            socket.emit('user_offline', {
                toUserId: toUserId,
                message: 'User is offline. Message queued for delivery.'
            });
            console.log(`[OFFLINE] ${toUserId} is offline`);
        }

        // Send confirmation back to sender
        socket.emit(SOCKET_EVENTS.MESSAGE_SENT, {
            _id: savedMessage._id,
            fromUserId: userId,
            toUserId: toUserId,
            fromUserName: name,
            message: trimmedMessage,
            time: savedMessage.createdAt.toISOString(),
            delivered: !!receiverUser,
            saved: true
        });

        console.log(`[CONFIRM] Sent confirmation to ${name}`);

    } catch (error) {
        console.error('[ERROR] Message sending failed:', error.message);
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
            message: MESSAGES.SOCKET.SOMETHING_WENT_WRONG 
        });
    }
}