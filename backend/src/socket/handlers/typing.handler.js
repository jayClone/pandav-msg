/**
 * Handle typing indicator
 * Notifies receiver when sender is typing
 */
export async function handleTyping(socket, io, data, userId, onlineUsers) {
    const { toUserId, isTyping } = data;

    // Find receiver in online users
    const receiverUser = onlineUsers.get(toUserId);

    // ✅ EMIT TO RECEIVER'S PERSONAL ROOM
    io.to(toUserId.toString()).emit('typing', {
        fromUserId: userId,
        isTyping: isTyping,
        userName: socket.user?.name || 'User'
    });
}