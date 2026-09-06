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

        // A user can have more than one socket connected at once (multiple
        // browser tabs, or a browser tab plus the Capacitor app) — track
        // every one of them per user, not just the most recent, so that ONE
        // of them disconnecting doesn't wipe the user's presence entry
        // while others are still live (see handleUserDisconnect below).
        const existingEntry = onlineUsers.get(userId);
        if (existingEntry) {
            existingEntry.socketIds.add(socket.id);
        } else {
            onlineUsers.set(userId, {
                socketIds: new Set([socket.id]),
                name: name,
                email: email,
                userId: userId
            });
        }

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

        const existingEntry = onlineUsers.get(userId);
        existingEntry?.socketIds.delete(socket.id);

        // Other tabs/devices for this user are still connected — presence,
        // delivery-status, and group online-member counts should all stay
        // exactly as they are. Broadcasting "offline" here would be wrong:
        // private-message.handler.js reads onlineUsers to decide the
        // `delivered` flag it reports back to the sender, so this used to
        // mark a still-online user's incoming messages as undelivered
        // purely because their OTHER tab happened to disconnect first.
        if (existingEntry && existingEntry.socketIds.size > 0) {
            return;
        }

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
