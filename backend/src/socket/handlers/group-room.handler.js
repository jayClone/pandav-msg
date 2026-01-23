import { SOCKET_EVENTS } from "@constants/response.messages.js";
import Group from "@models/Group.js";

/**
 * Handle group room join
 */
export async function handleJoinGroup(socket, io, payload, userId, name) {
    try {
        const { groupId } = payload || {};

        if (!groupId) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                message: 'Group ID is Required'
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

        // Check that the requesting user is a member of the group
        const isMember = Array.isArray(group.participants) && group.participants.some((participant) => {
            const participantId = typeof participant === 'object' && participant !== null && typeof participant.toString === 'function'
                ? participant.toString()
                : String(participant);
            return participantId === String(userId);
        });
        if (!isMember) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                message: 'User is not a member of this group'
            });
            return;
        }
        // Join socket room
        socket.join(groupId);
        console.log(`[GROUP] ${name} joined group ${groupId}`);

        // Notify group members
        io.to(groupId).emit('user_joined_group', {
            groupId: groupId,
            userId: userId,
            userName: name,
            message: `${name} joined the group`
        });
    } catch (error) {
        console.error('[ERROR] Join group failed:', error.message);
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
            message: 'Failed to join group' 
        });
    }
}

/**
 * Handle group room leave
 */
export async function handleLeaveGroup(socket, io, payload, userId, name) {
    try {
        const { groupId } = payload || {};

        if (!groupId) {
            return;
        }

        socket.leave(groupId);
        console.log(`[GROUP] ${name} left group ${groupId}`);

        io.to(groupId).emit('user_left_group', {
            groupId: groupId,
            userId: userId,
            userName: name,
            message: `${name} left the group`
        });
    } catch (error) {
        console.error('[ERROR] Leave group failed:', error.message);
    }
}