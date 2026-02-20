import { SOCKET_EVENTS } from "../../constant/response.messages.js";
import User from "../../models/User.js";
import Group from '../../models/Group.js';

/**
 * Handle user connect
 */
export async function handleUserConnect(socket, io, userId, email, name, onlineUsers) {
    try {
        // Set user online in db
        await User.findByIdAndUpdate(userId, {
            isOnline: true,
            lastSeen: Date.now()
        }).catch(() => {});

        // Store user in online users map
        onlineUsers.set(userId, {
            socketId: socket.id,
            name: name,
            email: email,
            userId: userId
        });

        // ✅ UPDATE ALL GROUPS - ADD TO ONLINE MEMBERS
        const userGroups = await Group.find({
            participants: userId
        });

        for (const group of userGroups) {
            // Add to online members if not already there
            if (!group.onlineMembers.includes(userId)) {
                group.onlineMembers.push(userId);
                await group.save();
            }

            // Notify group that user came online
            io.to(group._id.toString()).emit('user_came_online', {
                groupId: group._id,
                userId: userId,
                userName: name,
                onlineCount: group.onlineMembers.length,
            });
        }

        // Broadcast online users to all connected clients
        io.emit('online_users', Array.from(onlineUsers.values()).map(u => ({
            userId: u.userId,
            name: u.name,
            email: u.email,
            online: true
        })));

    } catch (error) {
        // Silently handle connection errors
    }
}

/**
 * Handle user disconnect
 */
export async function handleUserDisconnect(socket, io, userId, name, onlineUsers) {
    try {
        onlineUsers.delete(userId);

        // Set user offline in DB
        await User.findByIdAndUpdate(userId, { 
            isOnline: false,
            lastSeen: Date.now()
        }).catch(() => {});
        
        // ✅ UPDATE ALL GROUPS - REMOVE FROM ONLINE MEMBERS
        const userGroups = await Group.find({
            onlineMembers: userId
        });

        for (const group of userGroups) {
            group.onlineMembers = group.onlineMembers.filter(
                id => id.toString() !== userId.toString()
            );
            await group.save();

            // Notify group that user went offline
            io.to(group._id.toString()).emit('user_went_offline', {
                groupId: group._id,
                userId: userId,
                userName: name,
                onlineCount: group.onlineMembers.length,
            });
        }

        // Broadcast updated online users
        io.emit('online_users', Array.from(onlineUsers.values()).map(u => ({
            userId: u.userId,
            name: u.name,
            email: u.email,
            online: true
        })));

        // Emit user offline event
        io.emit('user_offline', { userId, name });

    } catch (error) {
        // Silently handle disconnection errors
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