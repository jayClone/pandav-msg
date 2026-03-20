import { SOCKET_EVENTS } from "../../constant/response.messages.js";
import Message from '../../models/Message.js';

/**
 * Handle group messages
 * Save to DB and broadcast to all group members
 */
export async function handleGroupMessage(socket, io, payload, userId, name) {
  try {
    const { groupId, message } = payload;

    if (!groupId || !message?.trim()) {
      return;
    }

    const savedMessage = await Message.create({
      senderId: userId,
      groupId: groupId,
      message: message.trim(),
      chatType: 'group',
      delivered: true,
      readBy: [],  
    });

    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('senderId', 'name email _id')
      .populate('readBy.userId', 'name email _id');

    io.to(groupId.toString()).emit(SOCKET_EVENTS.GROUP_MESSAGE, {
      _id: populatedMessage._id,
      groupId: groupId,
      fromUserId: userId,
      fromUserName: name,
      message: message.trim(),
      createdAt: populatedMessage.createdAt,
      delivered: true,
      read: false,
      readBy: [],  
      senderId: userId,
      senderName: name,
    });

  } catch (error) {
    console.error(' Error in handleGroupMessage:', error.message);
  }
}