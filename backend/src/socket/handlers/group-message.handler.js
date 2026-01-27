import { SOCKET_EVENTS } from "@constants/response.messages.js";
import Message from '@models/Message.js';
import Group from "@models/Group.js";

/**
 * Handle group messages
 * NOTE: Message is already saved via HTTP API
 * This handler just broadcasts to all group members
 */
export async function handleGroupMessage(socket, io, payload, userId, name) {
    try {
        const { groupId, message, _id, createdAt } = payload || {};

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

        if (!_id) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: 'Message ID is required' 
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

        console.log(`[GROUP-MSG] ${name} → ${groupId}: ${trimmedMessage.substring(0, 30)}`);

        // Prepare broadcast (message already saved via HTTP API)
        const messagePayload = {
            _id: _id,
            groupId: groupId,
            fromUserId: userId,
            fromUserName: name,
            message: trimmedMessage,
            time: createdAt || new Date().toISOString()
        };

        // Broadcast to all group members (including sender)
        io.to(groupId).emit('group_message', messagePayload);

    } catch (error) {
        console.error('[ERROR] Group message broadcast failed:', error.message);
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
            message: 'Failed to broadcast group message' 
        });
    }
}