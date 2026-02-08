import { SOCKET_EVENTS, MESSAGES } from "@constants/response.messages.js";
import Message from '@models/Message.js';
import Group from "@models/Group.js";

/**
 * Handle group messages
 * Save to DB and broadcast to all group members
 */
export async function handleGroupMessage(socket, io, payload, userId, name) {
  try {
    const { groupId, message } = payload;

    if (!groupId || !message?.trim()) {
      console.error('❌ Missing required fields');
      return;
    }

    // ✅ Save to database
    const savedMessage = await Message.create({
      senderId: userId,
      groupId: groupId,
      message: message.trim(),
      chatType: 'group',
      delivered: true,
    });

    // ✅ POPULATE to get proper structure
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('senderId', 'name email _id')
      .populate('readBy.userId', 'name email _id');

    console.log('✅ Message saved:', populatedMessage._id);

    // ✅ BROADCAST WITH FULL DATA including readBy (even if empty initially)
    io.to(groupId.toString()).emit(SOCKET_EVENTS.GROUP_MESSAGE, {
      _id: populatedMessage._id,
      groupId: groupId,
      fromUserId: userId,
      fromUserName: name,
      message: message.trim(),
      createdAt: populatedMessage.createdAt,
      delivered: true,
      read: false,
      readBy: populatedMessage.readBy || [],  // ✅ Include readBy array (empty initially)
      senderId: userId,
      senderName: name,
    });

    console.log('✅ Message broadcasted to group:', groupId);

  } catch (error) {
    console.error('❌ Error in handleGroupMessage:', error.message);
  }
}