import Friend from '../../models/Friend.js';
import Group from '../../models/Group.js';
import { getCache, setCache } from '../../config/redis.js';

// Mirrors call.handler.js's areFriends helper — duplicated rather than
// shared, matching how this codebase already re-implements the same
// friendship check per handler (private-message.handler.js, etc.) instead
// of a common utility.
async function areFriends(userId, toUserId) {
    const friendshipCacheKey = `friendship:${userId}:${toUserId}`;
    let friends = await getCache(friendshipCacheKey);

    if (friends === null) {
        const friendship = await Friend.findOne({
            $or: [
                { senderId: userId, receiverId: toUserId, status: 'accepted' },
                { senderId: toUserId, receiverId: userId, status: 'accepted' },
            ]
        });
        friends = !!friendship;
        await setCache(friendshipCacheKey, friends, 30);
    }

    return friends;
}

/**
 * Handle typing indicator
 * Notifies receiver (private chat) or the rest of the room (group chat)
 * when the sender is typing
 */
export async function handleTyping(socket, io, data, userId, onlineUsers) {
    const { toUserId, groupId, isTyping } = data;
    const userName = socket.user?.name || 'User';

    if (groupId) {
        // Every other handler here (messages, reactions, read receipts)
        // requires group membership before acting — typing was the one
        // gap: anyone who knew/guessed a groupId could broadcast a typing
        // indicator into that room without being a member.
        const group = await Group.findById(groupId);
        const isMember = group?.participants.some((p) => p.toString() === userId.toString());
        if (!isMember) {
            return;
        }

        // Broadcast to everyone else in the group's room — `socket.to`
        // (not `io.to`) excludes the sender, who already knows they're typing.
        socket.to(groupId.toString()).emit('typing', {
            fromUserId: userId,
            groupId,
            isTyping,
            userName
        });
        return;
    }

    if (toUserId) {
        // Messaging and calling are both friends-only — typing indicators
        // silently weren't, letting a non-friend probe whether an
        // arbitrary userId is online and send them unsolicited typing
        // pings.
        if (!(await areFriends(userId, toUserId))) {
            return;
        }

        io.to(toUserId.toString()).emit('typing', {
            fromUserId: userId,
            isTyping,
            userName
        });
    }
}