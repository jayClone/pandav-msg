/**
 * Handle typing indicator
 * Notifies receiver when sender is typing
 */
export async function handleTyping(socket, io, data, userId, onlineUsers) {
    const { toUserId, isTyping } = data;

    console.log(`⌨️ [TYPING] ${userId} is ${isTyping ? 'typing' : 'stopped typing'} to ${toUserId}`);

    // Find receiver in online users
    const receiverUser = onlineUsers.get(toUserId);
    
    if (receiverUser) {
        console.log(`📤 [SOCKET] Sending TYPING to ${receiverUser.name}`);
        io.to(receiverUser.socketId).emit('typing', {
            fromUserId: userId,
            isTyping: isTyping,
            userName: socket.user?.name || 'User'
        });
    } else {
        console.log(`⚠️ [TYPING] Receiver ${toUserId} is offline`);
    }
}