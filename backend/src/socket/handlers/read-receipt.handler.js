import Message from '@models/Message.js';

/**
 * Handle message read receipt
 * Mark message as read and notify sender
 */
export async function handleReadReceipt(socket, io, data, userId, onlineUsers) {
    const { messageId, groupId, senderId, userName } = data;

    console.log("📥 [READ_RECEIPT] Processing:", { messageId, groupId, senderId });

    try {
        // ✅ UPDATE MESSAGE IN DB
        const updatedMessage = await Message.findByIdAndUpdate(
            messageId,
            { read: true },
            { new: true }
        );

        if (!updatedMessage) {
            console.warn(`⚠️ Message ${messageId} not found`);
            return;
        }

        console.log(`✅ [DB] Message ${messageId} marked as read`);

        // ═══════════════════════════════════════════════════════════════════════════════
        // PRIVATE MESSAGE: Notify sender
        // ═══════════════════════════════════════════════════════════════════════════════
        if (senderId && !groupId) {
            const senderUser = onlineUsers.get(senderId);
            
            if (senderUser) {
                console.log(`📤 [SOCKET] Sending MESSAGE_READ to sender ${senderUser.name}`);
                io.to(senderUser.socketId).emit('message_read', {
                    messageId: messageId,
                    readBy: userId,
                    senderId: senderId,
                    readerName: userName || 'User',
                    readAt: new Date().toISOString()
                });
            } else {
                console.log(`⚠️ Sender ${senderId} is offline (message marked as read in DB)`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // GROUP MESSAGE: Broadcast to entire group
        // ═══════════════════════════════════════════════════════════════════════════════
        if (groupId) {
            console.log(`📡 [BROADCAST] Broadcasting MESSAGE_READ to group ${groupId}`);
            io.to(groupId).emit('message_read', {
                messageId: messageId,
                groupId: groupId,
                readBy: userId,
                readerName: userName || 'User',
                readAt: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error(`❌ [ERROR] Read receipt failed:`, err.message);
    }
}