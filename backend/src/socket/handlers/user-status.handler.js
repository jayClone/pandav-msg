import { SOCKET_EVENTS } from "../../constant/response.messages.js";
import User from "../../models/User.js";
import Group from '../../models/Group.js';

/**
 * Handle user connect
 */
export async function handleUserConnect(socket, io, userId, email, name, onlineUsers) {
    try {
        await User.findByIdAndUpdate(userId, {
            isOnline: true,
            lastSeen: Date.now()
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
            if (!group.onlineMembers.includes(userId)) {
                group.onlineMembers.push(userId);
                await group.save();
            }

            io.to(group._id.toString()).emit('user_came_online', {
                groupId: group._id,
                userId: userId,
                userName: name,
                onlineCount: group.onlineMembers.length,
            });
        }

        io.emit('online_users', Array.from(onlineUsers.values()).map(u => ({
            userId: u.userId,
            name: u.name,
            email: u.email,
            online: true
        })));

    } catch (error) {
    }
}

/**
 * Handle user disconnect
 */
export async function handleUserDisconnect(socket, io, userId, name, onlineUsers) {
    try {
        onlineUsers.delete(userId);

        await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: Date.now()
        }).catch(() => { });

        const userGroups = await Group.find({
            onlineMembers: userId
        });

        for (const group of userGroups) {
            group.onlineMembers = group.onlineMembers.filter(
                id => id.toString() !== userId.toString()
            );
            await group.save();

            io.to(group._id.toString()).emit('user_went_offline', {
                groupId: group._id,
                userId: userId,
                userName: name,
                onlineCount: group.onlineMembers.length,
            });
        }

        io.emit('online_users', Array.from(onlineUsers.values()).map(u => ({
            userId: u.userId,
            name: u.name,
            email: u.email,
            online: true
        })));
        io.emit('user_offline', { userId, name });

    } catch (error) {
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