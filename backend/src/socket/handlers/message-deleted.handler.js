import Message from '../../models/Message.js';

/**
 * Handle message deletion
 * Delete from DB and notify recipients
 */
export async function handleMessageDeleted(socket, io, data, userId, onlineUsers) {
    const { messageId, groupId, toUserId } = data;

    try {
        // ✅ DELETE FROM DATABASE
        const deletedMessage = await Message.findByIdAndDelete(messageId);

        if (!deletedMessage) {
            return;
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // PRIVATE MESSAGE: Notify receiver
        // ═══════════════════════════════════════════════════════════════════════════════
        if (toUserId && !groupId) {
            // ✅ EMIT TO RECEIVER'S PERSONAL ROOM
            io.to(toUserId.toString()).emit('message_deleted', {
                messageId: messageId,
                fromUserId: userId,
                toUserId: toUserId
            });

            // ✅ EMIT TO SENDER'S PERSONAL ROOM (Sync other tabs)
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
        // Silently handle deletion errors
    }
}