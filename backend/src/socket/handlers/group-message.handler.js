import { SOCKET_EVENTS } from "../../constant/response.messages.js";
import Message from '../../models/Message.js';
import Group from '../../models/Group.js';

/**
 * Handle group messages
 * Save to DB and broadcast to all group members
 */
export async function handleGroupMessage(socket, io, payload, userId, name) {
  try {
    const {
      groupId, message, isEncrypted, ciphertexts,
      messageType, imageCiphertext, imageNonce, imageMimeType
    } = payload;
    const isMedia = messageType === 'image' || messageType === 'video';

    if (!groupId) {
      return;
    }

    if (!isEncrypted && !isMedia && !message?.trim()) {
      return;
    }

    if (isEncrypted && (!ciphertexts || Object.keys(ciphertexts).length === 0)) {
      socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: 'ciphertexts is required for encrypted group messages' });
      return;
    }

    if (isMedia && (!imageCiphertext || !imageNonce || !imageMimeType)) {
      socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: `imageCiphertext, imageNonce, and imageMimeType are required for ${messageType} messages` });
      return;
    }

    const group = await Group.findById(groupId);
    if (!group) {
      socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: 'Group not found' });
      return;
    }

    const isMember = group.participants.some(
      (participant) => participant.toString() === String(userId)
    );

    if (!isMember) {
      socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: 'User is not a member of this group' });
      return;
    }

    if (isEncrypted) {
      // Every current member (including the sender) needs their own
      // ciphertext, or they'd have no way to ever read this message.
      const participantIds = group.participants.map(p => p.toString()).sort();
      const providedIds = Object.keys(ciphertexts).sort();
      const coversAllMembers = participantIds.length === providedIds.length &&
        participantIds.every((id, i) => id === providedIds[i]);

      if (!coversAllMembers) {
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: "ciphertexts must include exactly the group's current members" });
        return;
      }
    }

    const savedMessage = await Message.create({
      senderId: userId,
      groupId: groupId,
      chatType: 'group',
      isEncrypted: !!isEncrypted,
      delivered: true,
      readBy: [],
      ...(isMedia && { messageType, imageCiphertext, imageNonce, imageMimeType }),
      ...(isEncrypted
        ? { groupCiphertexts: ciphertexts }
        : (!isMedia && { message: message.trim() }))
    });

    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('senderId', 'name email _id')
      .populate('readBy.userId', 'name email _id');

    // Broadcasts the whole ciphertexts map to the room rather than a
    // per-member emit — each client picks out its own entry to decrypt.
    // Simpler than restructuring this into per-user room emits, and no
    // security cost: a NaCl box ciphertext reveals nothing without the
    // matching private key, so other members' entries are opaque to you.
    // For images/video, ciphertexts carries only the small wrapped
    // content-keys (one per member) — the one shared imageCiphertext blob
    // is included separately below, not duplicated per member.
    io.to(groupId.toString()).emit(SOCKET_EVENTS.GROUP_MESSAGE, {
      _id: populatedMessage._id,
      groupId: groupId,
      fromUserId: userId,
      fromUserName: name,
      isEncrypted: !!isEncrypted,
      message: (isEncrypted || isMedia) ? undefined : message.trim(),
      ciphertexts: isEncrypted ? ciphertexts : undefined,
      createdAt: populatedMessage.createdAt,
      delivered: true,
      read: false,
      readBy: [],
      senderId: userId,
      senderName: name,
      ...(isMedia && { messageType, imageCiphertext, imageNonce, imageMimeType })
    });

  } catch (error) {
    console.error(' Error in handleGroupMessage:', error.message);
  }
}