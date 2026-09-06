import { describe, it, expect } from 'bun:test';
import { consumeRateLimitToken, allowMessageEvent } from '@socket/socket-rate-limiter.js';

/**
 * Regression tests for the socket message rate limiter (loop iteration 8):
 * every message-sending REST route goes through messageArcjet (50/min per
 * user), but the frontend sends all real messages over Socket.IO instead,
 * which had no rate limit of any kind — a client stuck in a retry loop, or
 * a deliberately malicious one, could flood private_message/group_message
 * events without limit.
 */
describe('🧪 Socket Rate Limiter', () => {
  describe('consumeRateLimitToken (pure token bucket)', () => {
    it('allows calls up to capacity, then denies the next one', () => {
      const key = `test-key-${Date.now()}-a`;
      const opts = { capacity: 3, refillPerSecond: 0 }; // no refill during this test

      expect(consumeRateLimitToken(key, opts)).toBe(true);
      expect(consumeRateLimitToken(key, opts)).toBe(true);
      expect(consumeRateLimitToken(key, opts)).toBe(true);
      // Capacity exhausted — the 4th call in the same instant must be denied.
      expect(consumeRateLimitToken(key, opts)).toBe(false);
    });

    it('refills over time, allowing further calls once tokens accrue', async () => {
      const key = `test-key-${Date.now()}-b`;
      const opts = { capacity: 1, refillPerSecond: 20 }; // refills a full token in 50ms

      expect(consumeRateLimitToken(key, opts)).toBe(true);
      expect(consumeRateLimitToken(key, opts)).toBe(false);

      await new Promise((r) => setTimeout(r, 120));

      expect(consumeRateLimitToken(key, opts)).toBe(true);
    });

    it('different keys have independent buckets', () => {
      const opts = { capacity: 1, refillPerSecond: 0 };
      const keyA = `independent-a-${Date.now()}`;
      const keyB = `independent-b-${Date.now()}`;

      expect(consumeRateLimitToken(keyA, opts)).toBe(true);
      expect(consumeRateLimitToken(keyA, opts)).toBe(false);
      // keyB's bucket is untouched by keyA's usage.
      expect(consumeRateLimitToken(keyB, opts)).toBe(true);
    });
  });

  describe('allowMessageEvent (what socket.event.js actually calls)', () => {
    it('bypasses the limit under NODE_ENV=test, matching Arcjet\'s own test bypass', () => {
      // This test file itself runs with NODE_ENV=test, so this also proves
      // the rest of the suite's rapid message-sending tests won't be
      // affected by this new limiter.
      expect(process.env.NODE_ENV).toBe('test');
      for (let i = 0; i < 100; i++) {
        expect(allowMessageEvent('some-user-id')).toBe(true);
      }
    });
  });
});
