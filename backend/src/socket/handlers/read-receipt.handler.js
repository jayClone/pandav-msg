import Message from '../../models/Message.js';

export async function handleReadReceipt(socket, io, payload, userId, name) {
  try {
    const { messageId, groupId } = payload;

    if (!messageId) {
      return;
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return;
    }

    if (message.senderId.toString() === userId.toString()) {
      return;  
    }

    const userAlreadyRead = message.readBy?.some(
      (r) => r.userId?.toString() === userId.toString()
    );

    if (userAlreadyRead) {
      return;
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      {
        $push: {
          readBy: {
            userId: userId,
            readAt: new Date(),
          },
        },
        read: true,
        delivered: true,
      },
      { new: true }
    ).populate('readBy.userId', 'name email _id');

    const readReceiptData = {
      messageId: messageId,
      userId: userId,
      userName: name,
      readAt: new Date(),
      readBy: updatedMessage.readBy.map((r) => ({
        userId: r.userId?._id || r.userId,
        userName: r.userId?.name || name,
        readAt: r.readAt,
      })),
      readCount: updatedMessage.readBy.length,
    };

    if (groupId) {
      console.log(`📢 [READ_RECEIPT] Group broadcast: ${groupId}`);
      readReceiptData.groupId = groupId;
      io.to(groupId.toString()).emit('message_read', readReceiptData);
    } else {
      const senderRoom = message.senderId.toString();
      const receiverRoom = userId.toString();

      console.log(`📢 [READ_RECEIPT] Private broadcast -> Sender: ${senderRoom}, Receiver: ${receiverRoom}`);

      io.to(senderRoom).emit('message_read', readReceiptData);

      io.to(receiverRoom).emit('message_read', readReceiptData);
    }

  } catch (error) {
  }
}