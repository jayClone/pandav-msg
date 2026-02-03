import { SOCKET_EVENTS, MESSAGES } from "@constants/response.messages.js";
import Message from '@models/Message.js';
import Group from "@models/Group.js";

/**
 * Handle group messages
 * Save to DB and broadcast to all group members
 */
export async function handleGroupMessage(socket, io, payload, userId, name) {
  try {
    console.log('🔵 handleGroupMessage called');
    console.log('   Payload:', payload);
    console.log('   User:', { userId, name });

    const { groupId, message } = payload || {};

    // ✅ Validate required fields
    if (!groupId) {
      console.error('❌ Missing groupId');
      socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
        message: MESSAGES.GROUP.GROUP_ID_REQUIRED 
      });
      return;
    }

    if (!message || !message.trim()) {
      console.error('❌ Empty message');
      socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
        message: MESSAGES.GROUP.MESSAGE_EMPTY 
      });
      return;
    }

    const trimmedMessage = message.trim();

    console.log(`📝 [1/4] Validating group membership...`);

    // ✅ Verify user is member of group
    const group = await Group.findById(groupId);
    
    if (!group) {
      console.error('❌ Group not found:', groupId);
      socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
        message: MESSAGES.GROUP.GROUP_NOT_FOUND 
      });
      return;
    }

    console.log('   Group participants:', group.participants.map(p => p.toString()));
    console.log('   User ID:', userId.toString());

    // ✅ Check if user is member
    const isMember = group.participants?.some(
      (participant) => {
        const participantId = typeof participant === 'object' 
          ? participant.toString() 
          : String(participant);
        const userIdStr = String(userId);
        return participantId === userIdStr;
      }
    );

    console.log('   Is member:', isMember);

    if (!isMember) {
      console.error('❌ User is not a member of this group');
      socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
        message: MESSAGES.GROUP.USER_NOT_MEMBER 
      });
      return;
    }

    console.log(`✅ [2/4] User verified as group member`);
    console.log(`📝 [3/4] Saving message to DB...`);

    // ✅ Save to database
    const savedMessage = await Message.create({
      senderId: userId,
      groupId: groupId,
      message: trimmedMessage,
      chatType: 'group',
      createdAt: new Date(),
      read: false
    });

    if (!savedMessage) {
      throw new Error('Failed to save message to database');
    }

    console.log(`✅ [4/4] Message saved with ID: ${savedMessage._id}`);

    // ✅ Prepare payload for broadcast
    const messagePayload = {
      _id: savedMessage._id,
      messageId: savedMessage._id,
      groupId: groupId,
      fromUserId: userId,
      fromUserName: name,
      message: trimmedMessage,
      createdAt: savedMessage.createdAt.toISOString(),
      time: savedMessage.createdAt.toISOString(),
      senderId: userId,
      senderName: name,
      chatType: 'group'
    };

    console.log(`🔵 [5/5] Message payload prepared:`, messagePayload);

    // ✅ Get room members
    const room = io.sockets.adapter.rooms.get(groupId);
    const membersInRoom = room ? room.size : 0;
    
    console.log(`📊 Members in room ${groupId}: ${membersInRoom}`);
    console.log(`📤 Broadcasting 'group_message' to room: ${groupId}`);

    // ✅ Broadcast to ALL users in the group room
    io.to(groupId).emit(SOCKET_EVENTS.GROUP_MESSAGE, messagePayload);

    console.log(`✅ [COMPLETE] Message broadcast successfully`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error) {
    console.error('[❌ ERROR] Group message failed:', error.message);
    console.error(error.stack);
    socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
      message: MESSAGES.SOCKET.SOMETHING_WENT_WRONG,
      error: error.message 
    });
  }
}