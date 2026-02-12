import { SOCKET_EVENTS } from "../../constant/response.messages.js";
import Group from "../../models/Group.js";
import User from "../../models/User.js";

// ✅ Track online users per group (in-memory)
const groupOnlineUsers = new Map(); // groupId -> Set of userIds

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

        // ✅ FIX 1: Track this user as online in this group
        if (!groupOnlineUsers.has(groupId)) {
            groupOnlineUsers.set(groupId, new Set());
        }
        groupOnlineUsers.get(groupId).add(userId);

        console.log(`[GROUP] ${name} joined group ${groupId}`);
        console.log(`[ONLINE] Group ${groupId} now has ${groupOnlineUsers.get(groupId).size} online members`);

        // Join socket room
        socket.join(groupId);

        // ✅ FIX 2: Broadcast updated online members list to entire group
        const onlineUserIds = Array.from(groupOnlineUsers.get(groupId));
        const onlineMembers = await User.find({ _id: { $in: onlineUserIds } })
            .select('_id name email');

        io.to(groupId).emit('group_online_members', {
            groupId: groupId,
            onlineMembers: onlineMembers.map(u => ({
                userId: u._id,
                name: u.name,
                email: u.email
            })),
            onlineCount: onlineMembers.length,
            totalMembers: group.participants.length
        });

        // ✅ FIX 3: Notify about the join
        io.to(groupId).emit('user_joined_group', {
            groupId: groupId,
            userId: userId,
            userName: name,
            message: `${name} joined the group`,
            onlineCount: onlineMembers.length
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

        // ✅ FIX 4: Remove user from online tracking
        if (groupOnlineUsers.has(groupId)) {
            groupOnlineUsers.get(groupId).delete(userId);
            console.log(`[GROUP] ${name} left group ${groupId}`);
            console.log(`[ONLINE] Group ${groupId} now has ${groupOnlineUsers.get(groupId).size} online members`);

            // ✅ FIX 5: Broadcast updated online members list
            const group = await Group.findById(groupId);
            if (group) {
                const onlineUserIds = Array.from(groupOnlineUsers.get(groupId));
                const onlineMembers = await User.find({ _id: { $in: onlineUserIds } })
                    .select('_id name email');

                io.to(groupId).emit('group_online_members', {
                    groupId: groupId,
                    onlineMembers: onlineMembers.map(u => ({
                        userId: u._id,
                        name: u.name,
                        email: u.email
                    })),
                    onlineCount: onlineMembers.length,
                    totalMembers: group.participants.length
                });
            }

            // Clean up empty sets
            if (groupOnlineUsers.get(groupId).size === 0) {
                groupOnlineUsers.delete(groupId);
            }
        }

        socket.leave(groupId);

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

/**
 * Handle socket disconnect - remove from all groups
 */
export async function handleGroupDisconnect(groupId, userId) {
    try {
        if (groupOnlineUsers.has(groupId)) {
            groupOnlineUsers.get(groupId).delete(userId);
            console.log(`[DISCONNECT] User ${userId} removed from group ${groupId}`);

            if (groupOnlineUsers.get(groupId).size === 0) {
                groupOnlineUsers.delete(groupId);
            }
        }
    } catch (error) {
        console.error('[ERROR] Group disconnect failed:', error.message);
    }
}

/**
 * Get online members for a group
 */
export function getGroupOnlineMembers(groupId) {
    if (!groupOnlineUsers.has(groupId)) {
        return [];
    }
    return Array.from(groupOnlineUsers.get(groupId));
}