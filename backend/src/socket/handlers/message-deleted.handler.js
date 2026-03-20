import Message from '../../models/Message.js';

/**
 * Handle message deletion
 * Delete from DB and notify recipients
 */
export async function handleMessageDeleted(socket, io, data, userId, onlineUsers) {
    const { messageId, groupId, toUserId } = data;

    try {
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
    }
}