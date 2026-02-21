import { MESSAGES, SOCKET_EVENTS } from "../../constant/response.messages.js";
import Friend from "../../models/Friend";
import Message from '../../models/Message.js';
import { getCache, setCache } from '../../config/redis.js';

/**
 * Handle private messages
 */
export async function handlePrivateMessage(socket, io, payload, userId, name, onlineUsers) {
    const { toUserId, message, uniqueId } = payload;

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

        // ✅ FRIENDS VALIDATION (With short-term caching to prevent spamming DB)
        const friendshipCacheKey = `friendship:${userId}:${toUserId}`;
        let areFriends = await getCache(friendshipCacheKey);

        if (areFriends === null) {
            const friendship = await Friend.findOne({
                $or: [
                    { senderId: userId, receiverId: toUserId, status: 'accepted' },
                    { senderId: toUserId, receiverId: userId, status: 'accepted' },
                ]
            });

            areFriends = !!friendship;
            // Cache result for 30 seconds (short but effective for active chats)
            await setCache(friendshipCacheKey, areFriends, 30);
        }

        if (!areFriends) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                message: MESSAGES.FRIEND.CANNOT_MESSAGE
            });
            return;
        }


        // Save message to DB
        let savedMessage;
        try {
            savedMessage = await Message.create({
                senderId: userId,
                receiverId: toUserId,
                message: trimmedMessage,
                chatType: 'private'
            });
        } catch (dbError) {
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

        // ✅ EMIT TO RECEIVER'S PERSONAL ROOM (Targets all their sessions)
        io.to(toUserId.toString()).emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
            ...messagePayload,
            delivered: !!receiverUser
        });

        // ✅ EMIT TO SENDER'S PERSONAL ROOM (Syncs all their other tabs)
        if (userId.toString() !== toUserId.toString()) {
            io.to(userId.toString()).emit(SOCKET_EVENTS.MESSAGE_SENT, {
                ...messagePayload,
                delivered: !!receiverUser,
                saved: true
            });
        }
        else {
            // If receiver is OFFLINE: Still saved in DB
            socket.emit('user_offline', {
                toUserId: toUserId,
                message: 'User is offline. Message queued for delivery.'
            });
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

    } catch (error) {
        console.error('[ERROR] Message sending failed:', error.message);
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
            message: MESSAGES.SOCKET.SOMETHING_WENT_WRONG
        });
    }
}