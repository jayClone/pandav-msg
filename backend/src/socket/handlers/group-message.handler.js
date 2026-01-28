import { SOCKET_EVENTS } from "@constants/response.messages.js";
import Message from '@models/Message.js';
import Group from "@models/Group.js";

/**
 * Handle group messages
 */
export async function handleGroupMessage(socket, io, payload, userId, name) {
    try {
        const { groupId, message } = payload || {};

        if (!groupId) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: 'Group ID is required' 
            });
            return;
        }

        if (!message || typeof message !== "string" || message.trim().length === 0) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: "Message cannot be empty" 
            });
            return;
        }

        // Verify user is member
        const group = await Group.findById(groupId);
        if (!group) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: 'Group not found' 
            });
            return;
        }

        if ( !Array.isArray(group.participants) || !group.participants.some(p => p && p.toString() === userId.toString())) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: 'You are not a member of this group' 
            });
            return;
        }

        const trimmedMessage = message.trim();

        // Save to DB
        const savedMessage = await Message.create({
            senderId: userId,
            groupId: groupId,
            message: trimmedMessage,
            chatType: 'group'
        });

        console.log(`[GROUP-MSG] ${name} → ${groupId}: ${trimmedMessage.substring(0, 30)}`);

        const messagePayload = {
            _id: savedMessage._id,
            groupId: groupId,
            fromUserId: userId,
            fromUserName: name,
            message: trimmedMessage,
            time: savedMessage.createdAt.toISOString()
        };

        // Send to all group members
        io.to(groupId).emit('group_message', messagePayload);

        // Send confirmation to sender
        socket.emit(SOCKET_EVENTS.MESSAGE_SENT, {
            messageId: savedMessage._id,
            groupId: groupId,
            message: trimmedMessage,
            time: savedMessage.createdAt.toISOString(),
            saved: true
        });

    } catch (error) {
        console.error('[ERROR] Group message failed:', error.message);
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
            message: 'Failed to send group message' 
        });
    }
}