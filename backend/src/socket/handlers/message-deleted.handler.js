import Message from '@models/Message.js';

/**
 * Handle message deletion
 * Delete from DB and notify recipients
 */
export async function handleMessageDeleted(socket, io, data, userId, onlineUsers) {
    const { messageId, groupId, toUserId } = data;

    console.log("📥 [MESSAGE_DELETED] Processing:", { messageId, groupId, toUserId });

    try {
        // ✅ DELETE FROM DATABASE
        const deletedMessage = await Message.findByIdAndDelete(messageId);
        
        if (!deletedMessage) {
            console.warn(`⚠️ Message ${messageId} not found`);
            return;
        }

        console.log(`✅ [DB] Message ${messageId} deleted from database`);

        // ═══════════════════════════════════════════════════════════════════════════════
        // PRIVATE MESSAGE: Notify receiver
        // ═══════════════════════════════════════════════════════════════════════════════
        if (toUserId && !groupId) {
            const receiverUser = onlineUsers.get(toUserId);
            
            if (receiverUser) {
                console.log(`📤 [SOCKET] Sending MESSAGE_DELETED to ${receiverUser.name}`);
                io.to(receiverUser.socketId).emit('message_deleted', {
                    messageId: messageId,
                    fromUserId: userId,
                    toUserId: toUserId
                });
            } else {
                console.log(`⚠️ Receiver ${toUserId} is offline (message deleted locally)`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // GROUP MESSAGE: Broadcast to entire group
        // ═══════════════════════════════════════════════════════════════════════════════
        if (groupId) {
            console.log(`📡 [BROADCAST] Broadcasting MESSAGE_DELETED to group ${groupId}`);
            io.to(groupId).emit('message_deleted', {
                messageId: messageId,
                groupId: groupId,
                fromUserId: userId,
                deletedAt: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error("❌ [ERROR] Delete message failed:", err.message);
    }
}