import { MESSAGES, SOCKET_EVENTS } from "../../constant/response.messages.js";
import Friend from "../../models/Friend.js";
import { getCache, setCache } from '../../config/redis.js';

// userId -> peerUserId, set for the duration of a ringing/active call. Used
// to reject a second incoming call while one is already in progress, and to
// notify the other party if a socket drops mid-call (see
// cleanupCallOnDisconnect, called from socket.event.js's disconnect handler).
const activeCalls = new Map();

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
 * Caller sends a WebRTC SDP offer to start a call.
 */
export async function handleCallOffer(socket, io, payload, userId, name, onlineUsers) {
    const { toUserId, offer, callType } = payload;

    if (!toUserId || typeof toUserId !== "string" || !offer) {
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: MESSAGES.SOCKET.TO_USER_REQUIRED });
        return;
    }

    if (!(await areFriends(userId, toUserId))) {
        socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { message: MESSAGES.FRIEND.CANNOT_CALL });
        return;
    }

    if (!onlineUsers.has(toUserId)) {
        socket.emit(SOCKET_EVENTS.CALL_UNAVAILABLE, { toUserId, reason: 'offline' });
        return;
    }

    if (activeCalls.has(toUserId) || activeCalls.has(userId)) {
        socket.emit(SOCKET_EVENTS.CALL_UNAVAILABLE, { toUserId, reason: 'busy' });
        return;
    }

    activeCalls.set(userId, toUserId);
    activeCalls.set(toUserId, userId);

    io.to(toUserId.toString()).emit(SOCKET_EVENTS.CALL_OFFER, {
        fromUserId: userId,
        fromName: name,
        offer,
        callType: callType === 'video' ? 'video' : 'audio',
    });
}

/**
 * Callee sends back a WebRTC SDP answer, accepting the call.
 */
export async function handleCallAnswer(socket, io, payload, userId) {
    const { toUserId, answer } = payload;
    if (!toUserId || typeof toUserId !== "string" || !answer) return;

    io.to(toUserId.toString()).emit(SOCKET_EVENTS.CALL_ANSWER, {
        fromUserId: userId,
        answer,
    });
}

/**
 * Relay an ICE candidate to the other party.
 */
export async function handleCallIceCandidate(socket, io, payload, userId) {
    const { toUserId, candidate } = payload;
    if (!toUserId || typeof toUserId !== "string" || !candidate) return;

    io.to(toUserId.toString()).emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, {
        fromUserId: userId,
        candidate,
    });
}

/**
 * Callee declines a ringing call.
 */
export async function handleCallReject(socket, io, payload, userId) {
    const { toUserId } = payload;
    if (!toUserId || typeof toUserId !== "string") return;

    activeCalls.delete(userId);
    activeCalls.delete(toUserId);

    io.to(toUserId.toString()).emit(SOCKET_EVENTS.CALL_REJECT, { fromUserId: userId });
}

/**
 * Either party hangs up a ringing or active call.
 */
export async function handleCallEnd(socket, io, payload, userId) {
    const { toUserId } = payload;
    if (!toUserId || typeof toUserId !== "string") return;

    activeCalls.delete(userId);
    activeCalls.delete(toUserId);

    io.to(toUserId.toString()).emit(SOCKET_EVENTS.CALL_END, { fromUserId: userId });
}

/**
 * A socket dropped (tab closed, network loss, etc.) — if it was mid-call,
 * tell the other party the call is over instead of leaving them hanging
 * with a dead connection.
 */
export function cleanupCallOnDisconnect(io, userId) {
    const peerId = activeCalls.get(userId);
    if (!peerId) return;

    activeCalls.delete(userId);
    activeCalls.delete(peerId);

    io.to(peerId.toString()).emit(SOCKET_EVENTS.CALL_END, { fromUserId: userId });
}
