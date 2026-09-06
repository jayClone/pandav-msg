// Every Express route that sends a message goes through messageArcjet (50
// messages/minute per user) — but the frontend sends all real messages over
// Socket.IO, not those REST routes (see message.routes.js), and nothing in
// the socket layer rate-limited anything at all. A client stuck in a retry
// loop, or a deliberately malicious one, could flood private_message/
// group_message events without limit, each of which does a DB write.
//
// This mirrors messageArcjet's own limit (50/min per user) as a simple
// in-memory token bucket, keyed by userId rather than IP — Arcjet itself
// isn't used here since it's billed per call and designed around Express
// req/res, and socket events fire far more often than HTTP requests.
const buckets = new Map();

/**
 * Pure token-bucket check — no test-environment special-casing, so it can
 * be exercised directly in a unit test. `allowMessageEvent` below is what
 * socket.event.js actually calls; it adds the same test-suite bypass
 * Arcjet itself uses (see arcjet.js's isTestEnv) so this suite's own rapid
 * message-sending tests don't trip a limit meant for real clients.
 *
 * @param {string} key - bucket identity, e.g. `message:${userId}`
 * @param {{capacity: number, refillPerSecond: number}} opts
 * @returns {boolean} true if the call is allowed (and consumes a token)
 */
export function consumeRateLimitToken(key, { capacity, refillPerSecond }) {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
        bucket = { tokens: capacity, lastRefill: now };
        buckets.set(key, bucket);
    }

    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
        return false;
    }

    bucket.tokens -= 1;
    return true;
}

const MESSAGE_CAPACITY = 50;
const MESSAGE_REFILL_PER_SECOND = 50 / 60; // 50 per minute, matching messageArcjet

/**
 * Rate-limit gate for the socket message-send events. Bypassed under
 * NODE_ENV=test for the same reason Arcjet bypasses itself there — this
 * suite's tests share test users across many rapid sends within one run
 * and aren't what this limit is meant to catch.
 */
export function allowMessageEvent(userId) {
    if (process.env.NODE_ENV === 'test') return true;
    return consumeRateLimitToken(`message:${userId}`, {
        capacity: MESSAGE_CAPACITY,
        refillPerSecond: MESSAGE_REFILL_PER_SECOND,
    });
}
