/**
 * Handle typing indicator
 * Notifies receiver (private chat) or the rest of the room (group chat)
 * when the sender is typing
 */
export async function handleTyping(socket, io, data, userId, onlineUsers) {
    const { toUserId, groupId, isTyping } = data;
    const userName = socket.user?.name || 'User';

    if (groupId) {
        // Broadcast to everyone else in the group's room — `socket.to`
        // (not `io.to`) excludes the sender, who already knows they're typing.
        socket.to(groupId.toString()).emit('typing', {
            fromUserId: userId,
            groupId,
            isTyping,
            userName
        });
        return;
    }

    if (toUserId) {
        io.to(toUserId.toString()).emit('typing', {
            fromUserId: userId,
            isTyping,
            userName
        });
    }
}