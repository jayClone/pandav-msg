import { SOCKET_EVENTS } from "../../constant/response.messages.js";
import Message from '../../models/Message.js';

/**
 * Handle message deletion
 * Delete from DB and notify recipients
 */
export async function handleMessageDeleted(socket, io, data, userId, onlineUsers) {
    const { messageId } = data;

    try {
        const message = await Message.findById(messageId);

        if (!message) {
            return;
        }

        if (message.senderId.toString() !== userId.toString()) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                message: 'you can only delete your own message'
            });
            return;
        }

        // Capture the message's own routing fields before it's gone —
        // broadcasting to whatever toUserId/groupId the client's payload
        // claimed (rather than what the message itself actually belongs
        // to) meant a stale or wrong client value could leave the real
        // recipient never notified, still showing a message that's
        // already gone from the DB.
        const isGroupMessage = message.chatType === 'group';
        const receiverId = message.receiverId;
        const groupId = message.groupId;

        const deletedMessage = await Message.findByIdAndDelete(messageId);

        if (!deletedMessage) {
            return;
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // GROUP MESSAGE: Broadcast to entire group
        // ═══════════════════════════════════════════════════════════════════════════════
        if (isGroupMessage && groupId) {
            io.to(groupId.toString()).emit('message_deleted', {
                messageId: messageId,
                groupId: groupId,
                fromUserId: userId,
                deletedAt: new Date().toISOString()
            });
        }
        // ═══════════════════════════════════════════════════════════════════════════════
        // PRIVATE MESSAGE: Notify receiver (and the sender's other tabs)
        // ═══════════════════════════════════════════════════════════════════════════════
        else if (receiverId) {
            io.to(receiverId.toString()).emit('message_deleted', {
                messageId: messageId,
                fromUserId: userId,
                toUserId: receiverId
            });

            io.to(userId.toString()).emit('message_deleted', {
                messageId: messageId,
                fromUserId: userId,
                toUserId: receiverId
            });
        }
    } catch (err) {
        console.error('[ERROR] handleMessageDeleted failed:', err.message);
    }
}