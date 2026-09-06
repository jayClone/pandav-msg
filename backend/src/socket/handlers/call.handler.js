import { MESSAGES, SOCKET_EVENTS } from "../../constant/response.messages.js";
import Friend from "../../models/Friend.js";
import { getCache, setCache } from '../../config/redis.js';

// userId -> { peerId, token }, set for the duration of a ringing/active
// call. Used to reject a second incoming call while one is already in
// progress, and to notify the other party if a socket drops mid-call (see
// cleanupCallOnDisconnect, called from socket.event.js's disconnect
// handler). `token` identifies this specific call session so a stale ring
// timer (see RING_TIMEOUT_MS below) can never act on a later, unrelated
// call that happens to reuse the same pair of userIds.
const activeCalls = new Map();

// token -> timeoutId, so handleCallAnswer can cancel the ring timer once a
// call is actually picked up.
const ringTimers = new Map();

// If the callee never answers, rejects, or goes offline, nothing used to
// clear activeCalls — the ringing state (and the "busy" block it causes for
// BOTH users, against anyone, not just each other) lasted forever until
// someone manually hung up. Read dynamically (not cached at module load) so
// tests can shrink it via CALL_RING_TIMEOUT_MS without waiting 45 real
// seconds.
function getRingTimeoutMs() {
    return parseInt(process.env.CALL_RING_TIMEOUT_MS, 10) || 45_000;
}

function clearCallState(userId, peerId, token) {
    activeCalls.delete(userId);
    activeCalls.delete(peerId);
    const timeoutId = ringTimers.get(token);
    if (timeoutId) {
        clearTimeout(timeoutId);
        ringTimers.delete(token);
    }
}

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

    const token = crypto.randomUUID();
    activeCalls.set(userId, { peerId: toUserId, token });
    activeCalls.set(toUserId, { peerId: userId, token });

    io.to(toUserId.toString()).emit(SOCKET_EVENTS.CALL_OFFER, {
        fromUserId: userId,
        fromName: name,
        offer,
        callType: callType === 'video' ? 'video' : 'audio',
    });

    const timeoutId = setTimeout(() => {
        // Only fires if this exact call session is still the one ringing —
        // handleCallAnswer/Reject/End/disconnect all clear it first via
        // clearCallState, so an already-answered or already-ended call
        // (even a brand new one between the same two users) is untouched.
        const current = activeCalls.get(userId);
        if (!current || current.token !== token) return;

        clearCallState(userId, toUserId, token);
        socket.emit(SOCKET_EVENTS.CALL_UNAVAILABLE, { toUserId, reason: 'timeout' });
        io.to(toUserId.toString()).emit(SOCKET_EVENTS.CALL_END, { fromUserId: userId, reason: 'timeout' });
    }, getRingTimeoutMs());

    ringTimers.set(token, timeoutId);
}

/**
 * Callee sends back a WebRTC SDP answer, accepting the call.
 */
export async function handleCallAnswer(socket, io, payload, userId) {
    const { toUserId, answer } = payload;
    if (!toUserId || typeof toUserId !== "string" || !answer) return;

    // The call's been picked up — cancel its ring timer so RING_TIMEOUT_MS
    // doesn't cut the now-active call off later. activeCalls itself stays
    // set for the duration of the call (cleared by reject/end/disconnect).
    const timeoutId = ringTimers.get(activeCalls.get(userId)?.token);
    if (timeoutId) clearTimeout(timeoutId);

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

    clearCallState(userId, toUserId, activeCalls.get(userId)?.token);

    io.to(toUserId.toString()).emit(SOCKET_EVENTS.CALL_REJECT, { fromUserId: userId });
}

/**
 * Either party hangs up a ringing or active call.
 */
export async function handleCallEnd(socket, io, payload, userId) {
    const { toUserId } = payload;
    if (!toUserId || typeof toUserId !== "string") return;

    clearCallState(userId, toUserId, activeCalls.get(userId)?.token);

    io.to(toUserId.toString()).emit(SOCKET_EVENTS.CALL_END, { fromUserId: userId });
}

/**
 * A socket dropped (tab closed, network loss, etc.) — if it was mid-call,
 * tell the other party the call is over instead of leaving them hanging
 * with a dead connection.
 */
export function cleanupCallOnDisconnect(io, userId) {
    const current = activeCalls.get(userId);
    if (!current) return;
    const { peerId, token } = current;

    clearCallState(userId, peerId, token);

    io.to(peerId.toString()).emit(SOCKET_EVENTS.CALL_END, { fromUserId: userId });
}
