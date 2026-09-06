import Message from '../../models/Message.js';
import Group from '../../models/Group.js';

export async function handleReadReceipt(socket, io, payload, userId, name) {
  try {
    const { messageId } = payload;

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

    // The sender check above isn't enough on its own — anyone who knew (or
    // guessed) a messageId could otherwise mark someone else's private
    // message as read, or a non-member's read receipt into a group they
    // never joined. Mirror reaction.handler.js's authorization check,
    // trusting the message's own chatType/receiverId/groupId rather than
    // whatever the client's payload claims.
    const isPrivate = message.chatType === 'private';

    if (isPrivate) {
      const isParticipant = message.receiverId && message.receiverId.toString() === userId.toString();
      if (!isParticipant) {
        return;
      }
    } else {
      const group = await Group.findById(message.groupId);
      const isMember = group?.participants.some((p) => p.toString() === userId.toString());
      if (!isMember) {
        return;
      }
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

    if (!isPrivate) {
      const groupId = message.groupId.toString();
      console.log(`📢 [READ_RECEIPT] Group broadcast: ${groupId}`);
      readReceiptData.groupId = groupId;
      io.to(groupId).emit('message_read', readReceiptData);
    } else {
      const senderRoom = message.senderId.toString();
      const receiverRoom = userId.toString();

      console.log(`📢 [READ_RECEIPT] Private broadcast -> Sender: ${senderRoom}, Receiver: ${receiverRoom}`);

      io.to(senderRoom).emit('message_read', readReceiptData);

      io.to(receiverRoom).emit('message_read', readReceiptData);
    }

  } catch (error) {
    console.error('[ERROR] handleReadReceipt failed:', error.message);
  }
}