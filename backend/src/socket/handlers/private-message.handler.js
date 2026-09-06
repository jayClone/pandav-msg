import { MESSAGES, SOCKET_EVENTS } from "../../constant/response.messages.js";
import Friend from "../../models/Friend.js";
import Message from '../../models/Message.js';
import { getCache, setCache } from '../../config/redis.js';

/**
 * Handle private messages
 */
export async function handlePrivateMessage(socket, io, payload, userId, name, onlineUsers) {
    const {
        toUserId, message, isEncrypted, uniqueId,
        messageType, imageCiphertext, imageNonce, imageMimeType
    } = payload;
    const isMedia = messageType === 'image' || messageType === 'video';

    try {
        if (!toUserId || typeof toUserId !== "string") {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                message: MESSAGES.SOCKET.TO_USER_REQUIRED,
                uniqueId
            });
            return;
        }

        if (isMedia) {
            if (!imageCiphertext || !imageNonce || !imageMimeType) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                    message: `imageCiphertext, imageNonce, and imageMimeType are required for ${messageType} messages`,
                    uniqueId
                });
                return;
            }
            // `message` still carries the wrapped content-key for the
            // recipient (same field private text ciphertext uses) — still
            // required for images/video too.
        }

        if (!message || typeof message !== "string" || message.length === 0) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                message: MESSAGES.SOCKET.MESSAGE_EMPTY,
                uniqueId
            });
            return;
        }

        // For encrypted messages, don't trim (preserves encryption format)
        // For plaintext messages, trim whitespace
        const processedMessage = (isEncrypted || isMedia) ? message : message.trim();

        if (!isEncrypted && !isMedia && processedMessage.length === 0) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                message: MESSAGES.SOCKET.MESSAGE_EMPTY,
                uniqueId
            });
            return;
        }

        const receiverUser = onlineUsers.get(toUserId);

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
            await setCache(friendshipCacheKey, areFriends, 30);
        }

        if (!areFriends) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                message: MESSAGES.FRIEND.CANNOT_MESSAGE,
                uniqueId
            });
            return;
        }

        let savedMessage;
        try {
            savedMessage = await Message.create({
                senderId: userId,
                receiverId: toUserId,
                message: processedMessage,
                chatType: 'private',
                isEncrypted: isEncrypted || false, // Store encryption flag
                ...(isMedia && { messageType, imageCiphertext, imageNonce, imageMimeType })
            });
        } catch (dbError) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                message: 'Failed to save message',
                uniqueId
            });
            return;
        }

        const messagePayload = {
            _id: savedMessage._id,
            uniqueId,
            fromUserId: userId,
            toUserId: toUserId,
            fromUserName: name,
            message: processedMessage,
            time: savedMessage.createdAt.toISOString(),
            delivered: false,
            isEncrypted: isEncrypted || false, // Include encryption flag in payload
            ...(isMedia && { messageType, imageCiphertext, imageNonce, imageMimeType })
        };

        io.to(toUserId.toString()).emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
            ...messagePayload,
            delivered: !!receiverUser
        });

        if (userId.toString() !== toUserId.toString()) {
            io.to(userId.toString()).emit(SOCKET_EVENTS.MESSAGE_SENT, {
                ...messagePayload,
                delivered: !!receiverUser,
                saved: true
            });
        }
        else {
            socket.emit('user_offline', {
                toUserId: toUserId,
                message: 'User is offline. Message queued for delivery.'
            });
        }

        socket.emit(SOCKET_EVENTS.MESSAGE_SENT, {
            _id: savedMessage._id,
            uniqueId,
            fromUserId: userId,
            toUserId: toUserId,
            fromUserName: name,
            message: processedMessage,
            time: savedMessage.createdAt.toISOString(),
            delivered: !!receiverUser,
            saved: true,
            isEncrypted: isEncrypted || false,
            ...(isMedia && { messageType, imageCiphertext, imageNonce, imageMimeType })
        });

    } catch (error) {
        console.error('[ERROR] Message sending failed:', error.message);
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
            message: MESSAGES.SOCKET.SOMETHING_WENT_WRONG,
            uniqueId
        });
    }
}