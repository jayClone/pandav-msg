/**
 * Handle typing indicator
 * Notifies receiver when sender is typing
 */
export async function handleTyping(socket, io, data, userId, onlineUsers) {
    const { toUserId, isTyping } = data;


    io.to(toUserId.toString()).emit('typing', {
        fromUserId: userId,
        isTyping: isTyping,
        userName: socket.user?.name || 'User'
    });
}