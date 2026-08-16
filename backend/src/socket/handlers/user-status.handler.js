import { SOCKET_EVENTS } from "../../constant/response.messages.js";
import User from "../../models/User.js";
import Group from '../../models/Group.js';

/**
 * Handle user connect
 */
export async function handleUserConnect(socket, io, userId, email, name, onlineUsers) {
    try {
        const now = new Date();

        await User.findByIdAndUpdate(userId, {
            isOnline: true,
            lastSeen: now
        }).catch(() => { });

        socket.join(userId.toString());
        console.log(`🏠 [SOCKET] User ${name} joined personal room: ${userId}`);

        onlineUsers.set(userId, {
            socketId: socket.id,
            name: name,
            email: email,
            userId: userId
        });

        const userGroups = await Group.find({
            participants: userId
        });

        for (const group of userGroups) {
            const updatedGroup = await Group.findByIdAndUpdate(
                group._id,
                { $addToSet: { onlineMembers: userId } },
                { new: true }
            );

            io.to(group._id.toString()).emit('user_came_online', {
                groupId: group._id,
                userId: userId,
                userName: name,
                onlineCount: updatedGroup.onlineMembers.length,
            });
        }

        io.emit('online_users', Array.from(onlineUsers.values()).map(u => ({
            userId: u.userId,
            name: u.name,
            email: u.email,
            online: true,
            lastSeen: now.toISOString()
        })));

    } catch (error) {
        console.error('[ERROR] handleUserConnect failed:', error.message);
    }
}

/**
 * Handle user disconnect
 */
export async function handleUserDisconnect(socket, io, userId, name, onlineUsers) {
    try {
        const now = new Date();
        onlineUsers.delete(userId);

        await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: now
        }).catch(() => { });

        const userGroups = await Group.find({
            onlineMembers: userId
        });

        for (const group of userGroups) {
            const updatedGroup = await Group.findByIdAndUpdate(
                group._id,
                { $pull: { onlineMembers: userId } },
                { new: true }
            );

            io.to(group._id.toString()).emit('user_went_offline', {
                groupId: group._id,
                userId: userId,
                userName: name,
                onlineCount: updatedGroup.onlineMembers.length,
            });
        }

        io.emit('online_users', Array.from(onlineUsers.values()).map(u => ({
            userId: u.userId,
            name: u.name,
            email: u.email,
            online: true
        })));
        io.emit('user_offline', { userId, name, lastSeen: now.toISOString() });

    } catch (error) {
        console.error('[ERROR] handleUserDisconnect failed:', error.message);
    }
}

/**
 * Helper: Broadcast online users to all connected clients
 */
function broadcastOnlineUsers(io, onlineUsers) {
    const onlineUsersList = Array.from(onlineUsers.values()).map(user => ({
        userId: user.userId,
        name: user.name,
        email: user.email,
        status: 'online'
    }));
    io.emit(SOCKET_EVENTS.ONLINE_USERS, onlineUsersList);
    console.log(`[BROADCAST] Online users: ${onlineUsersList.length}`);
}
