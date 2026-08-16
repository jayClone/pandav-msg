import { SOCKET_EVENTS } from "../../constant/response.messages.js";
import Message from '../../models/Message.js';

/**
 * Handle message deletion
 * Delete from DB and notify recipients
 */
export async function handleMessageDeleted(socket, io, data, userId, onlineUsers) {
    const { messageId, groupId, toUserId } = data;

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

        const deletedMessage = await Message.findByIdAndDelete(messageId);

        if (!deletedMessage) {
            return;
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // PRIVATE MESSAGE: Notify receiver
        // ═══════════════════════════════════════════════════════════════════════════════
        if (toUserId && !groupId) {
            io.to(toUserId.toString()).emit('message_deleted', {
                messageId: messageId,
                fromUserId: userId,
                toUserId: toUserId
            });

            io.to(userId.toString()).emit('message_deleted', {
                messageId: messageId,
                fromUserId: userId,
                toUserId: toUserId
            });
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // GROUP MESSAGE: Broadcast to entire group
        // ═══════════════════════════════════════════════════════════════════════════════
        if (groupId) {
            io.to(groupId).emit('message_deleted', {
                messageId: messageId,
                groupId: groupId,
                fromUserId: userId,
                deletedAt: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error('[ERROR] handleMessageDeleted failed:', err.message);
    }
}