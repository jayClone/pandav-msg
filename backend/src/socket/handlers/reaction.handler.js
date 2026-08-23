import { SOCKET_EVENTS } from "../../constant/response.messages.js";
import Message from '../../models/Message.js';
import Group from '../../models/Group.js';

// Keep this in sync with the emoji set actually reachable from the client's
// quick-react bar (see ReactionBar.jsx) — nothing stops a full custom emoji
// beyond it, this just rejects obviously-wrong payloads.
const MAX_EMOJI_LENGTH = 8;

/**
 * Handle a message reaction toggle: same emoji again removes it, a
 * different emoji replaces the user's existing reaction (one per user per
 * message), a fresh emoji adds it. Broadcasts the message's full reaction
 * list back to whoever can see the message — private-chat sender/receiver,
 * or every current group member.
 */
export async function handleMessageReaction(socket, io, data, userId) {
    const { messageId, emoji } = data;

    if (!messageId || !emoji || typeof emoji !== 'string' || emoji.length > MAX_EMOJI_LENGTH) {
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: 'A valid messageId and emoji are required' });
        return;
    }

    try {
        const message = await Message.findById(messageId);
        if (!message || message.deleted) {
            return;
        }

        const isPrivate = message.chatType === 'private';

        if (isPrivate) {
            const isParticipant =
                message.senderId.toString() === userId.toString() ||
                (message.receiverId && message.receiverId.toString() === userId.toString());
            if (!isParticipant) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: 'You cannot react to this message' });
                return;
            }
        } else {
            const group = await Group.findById(message.groupId);
            const isMember = group?.participants.some((p) => p.toString() === userId.toString());
            if (!isMember) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: 'You are not a member of this group' });
                return;
            }
        }

        const existingIndex = message.reactions.findIndex((r) => r.userId.toString() === userId.toString());

        if (existingIndex !== -1 && message.reactions[existingIndex].emoji === emoji) {
            message.reactions.splice(existingIndex, 1);
        } else if (existingIndex !== -1) {
            message.reactions[existingIndex].emoji = emoji;
        } else {
            message.reactions.push({ userId, emoji });
        }

        await message.save();

        const payload = {
            messageId: message._id,
            reactions: message.reactions.map((r) => ({ userId: r.userId, emoji: r.emoji })),
        };

        if (isPrivate) {
            io.to(message.senderId.toString()).emit(SOCKET_EVENTS.MESSAGE_REACTION, payload);
            if (message.receiverId) {
                io.to(message.receiverId.toString()).emit(SOCKET_EVENTS.MESSAGE_REACTION, payload);
            }
        } else {
            io.to(message.groupId.toString()).emit(SOCKET_EVENTS.MESSAGE_REACTION, {
                ...payload,
                groupId: message.groupId,
            });
        }
    } catch (err) {
        console.error('[ERROR] handleMessageReaction failed:', err.message);
    }
}
