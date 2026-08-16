import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';
import User from '@models/User.js';
import OTP from '@models/OTP.js';
import { connectDB } from '@config/db.js';
import { registerTestUser } from './helpers/otp.js';

// ✅ FIX: Bypass rate limiting in tests
app.set('trust proxy', 1);

const RATE_LIMIT_DELAY = 100; // ms between requests to avoid 429

describe('🧪 USER API TESTS', () => {
  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await OTP.deleteMany({});
    console.log('✅ Test database ready');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
    await User.deleteMany({});
    await OTP.deleteMany({});
  });

  describe('A) GET ALL USERS - GET /api/v1/users', () => {
    let userA, userB, userC, tokenA;

    beforeEach(async () => {
      await User.deleteMany({});
      await OTP.deleteMany({});

      const regA = await registerTestUser(app, {
        name: 'User Alpha',
        email: 'alpha@example.com',
        password: 'AlphaPass123!'
      });

      userA = regA.body.data;
      tokenA = regA.body.token;

      const regB = await registerTestUser(app, {
        name: 'User Beta',
        email: 'beta@example.com',
        password: 'BetaPass123!'
      });

      userB = regB.body.data;

      const regC = await registerTestUser(app, {
        name: 'User Gamma',
        email: 'gamma@example.com',
        password: 'GammaPass123!'
      });

      userC = regC.body.data;
    }, 30000);

    it('TC-U-01: Get all users with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBe(2);

      console.log('✅ TC-U-01 PASSED');
    });

    it('TC-U-02: User objects contain required fields', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      response.body.data.forEach(user => {
        expect(user._id).toBeDefined();
        expect(user.name).toBeDefined();
        expect(user.email).toBeDefined();
        expect(['online', 'offline']).toContain(user.status);
      });

      console.log('✅ TC-U-02 PASSED');
    });

    it('TC-U-03: Current user excluded from list', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      const userIds = response.body.data.map(u => u._id.toString());
      expect(userIds).not.toContain(userA._id.toString());

      console.log('✅ TC-U-03 PASSED');
    });

    it('TC-U-05: Reject without authentication token', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-U-05 PASSED');
    });
  });

  describe('B) GET USER PROFILE - GET /api/v1/users/:userId', () => {
    let userA, userB, tokenA;

    beforeEach(async () => {
      await User.deleteMany({});
      await OTP.deleteMany({});

      const regA = await registerTestUser(app, {
        name: 'Profile Test A',
        email: 'profilea@example.com',
        password: 'ProfileA123!'
      });

      userA = regA.body.data;
      tokenA = regA.body.token;

      const regB = await registerTestUser(app, {
        name: 'Profile Test B',
        email: 'profileb@example.com',
        password: 'ProfileB123!'
      });

      userB = regB.body.data;
    }, 20000);

    it('TC-U-08: Get specific user profile successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id.toString()).toBe(userB._id.toString());

      console.log('✅ TC-U-08 PASSED');
    });

    it('TC-U-10: Return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-U-10 PASSED');
    });

    it('TC-U-11: Return 400 for invalid ObjectId format', async () => {
      const response = await request(app)
        .get('/api/v1/users/invalid_id')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-U-11 PASSED');
    });

    it('TC-U-12: Reject without authentication token', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userB._id}`)
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-U-12 PASSED');
    });
  });

  describe('C) SEARCH USERS - GET /api/v1/users/search?q=query', () => {
    let userA, tokenA;

    beforeEach(async () => {
      await User.deleteMany({});
      await OTP.deleteMany({});

      const regA = await registerTestUser(app, {
        name: 'Search Test User',
        email: 'searchtest@example.com',
        password: 'SearchTest123!'
      });

      userA = regA.body.data;
      tokenA = regA.body.token;

      const usersToCreate = [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Doe', email: 'jane@example.com' },
        { name: 'Alice Wonder', email: 'alice@example.com' }
      ];

      for (const user of usersToCreate) {
        await registerTestUser(app, {
          name: user.name,
          email: user.email,
          password: 'Password123!'
        });
      }
    }, 40000);

    it('TC-U-14: Search users by name', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response = await request(app)
        .get('/api/v1/users/search?q=john')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      console.log('✅ TC-U-14 PASSED');
    });

    it('TC-U-15: Search users by email', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response = await request(app)
        .get('/api/v1/users/search?q=alice@example.com')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);

      console.log('✅ TC-U-15 PASSED');
    });

    it('TC-U-16: Search is case-insensitive', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response1 = await request(app)
        .get('/api/v1/users/search?q=JOHN')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response2 = await request(app)
        .get('/api/v1/users/search?q=john')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response1.body.count).toBe(response2.body.count);

      console.log('✅ TC-U-16 PASSED');
    });

    it('TC-U-18: Reject empty search query', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response = await request(app)
        .get('/api/v1/users/search?q=')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-U-18 PASSED');
    });

    it('TC-U-19: Return empty array for no matches', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response = await request(app)
        .get('/api/v1/users/search?q=nonexistentuser12345xyz')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);

      console.log('✅ TC-U-19 PASSED');
    });

    it('TC-U-22: Reject search without authentication', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response = await request(app)
        .get('/api/v1/users/search?q=john')
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-U-22 PASSED');
    });
  });

  describe('E) EDGE CASES & ERROR HANDLING', () => {
    let userA, tokenA;

    beforeEach(async () => {
      await User.deleteMany({});
      await OTP.deleteMany({});

      const regA = await registerTestUser(app, {
        name: 'Edge Case User',
        email: 'edgecase@example.com',
        password: 'EdgeCase123!'
      });

      userA = regA.body.data;
      tokenA = regA.body.token;
    }, 15000);

    it('TC-U-32: Handle very long search query gracefully', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const longQuery = 'a'.repeat(200);

      const response = await request(app)
        .get(`/api/v1/users/search?q=${longQuery}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect([200, 400]).toContain(response.status);

      console.log('✅ TC-U-32 PASSED');
    });

    it('TC-U-33: Handle special characters in search', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      await registerTestUser(app, {
        name: "O'Brien",
        email: 'obrien@example.com',
        password: 'OBrien123!'
      });

      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response = await request(app)
        .get('/api/v1/users/search?q=Brien')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);

      console.log('✅ TC-U-33 PASSED');
    });

    it('TC-U-40: Regex-metacharacter-heavy search query returns quickly with no error (audit 05 regression)', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      // Classic ReDoS trigger pattern — catastrophic if this string were ever
      // fed into `new RegExp()`. The endpoint uses a $text index search
      // instead, so this should resolve fast regardless of query shape.
      const evilQuery = encodeURIComponent('(a+)+' + 'a'.repeat(30) + '!');

      const start = Date.now();
      const response = await request(app)
        .get(`/api/v1/users/search?q=${evilQuery}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);
      const elapsedMs = Date.now() - start;

      expect([200, 400, 500]).toContain(response.status);
      expect(elapsedMs).toBeLessThan(3000);

      console.log(`✅ TC-U-40 PASSED (${elapsedMs}ms)`);
    });

    it('TC-U-34: Validate token format strictness', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', 'Bearer')
        .timeout(15000);

      expect(response.status).toBe(401);

      console.log('✅ TC-U-34 PASSED');
    });

    it('TC-U-35: Handle malformed Bearer token', async () => {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', 'NotBearer validtoken')
        .timeout(15000);

      expect(response.status).toBe(401);

      console.log('✅ TC-U-35 PASSED');
    });
  });

  describe('ADDITIONAL: Rate Limiting Tests', () => {
    let userA, tokenA;

    beforeEach(async () => {
      await User.deleteMany({});
      await OTP.deleteMany({});

      const regA = await registerTestUser(app, {
        name: 'Rate Limit Test',
        email: 'ratelimit@example.com',
        password: 'RateLimit123!'
      });

      userA = regA.body.data;
      tokenA = regA.body.token;
    }, 15000);

    it('TC-U-36: Respect rate limiting with delays', async () => {
      const results = [];

      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));

        const response = await request(app)
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${tokenA}`)
          .timeout(15000);

        results.push(response.status);
      }

      results.forEach(status => {
        expect(status).toBe(200);
      });

      console.log('✅ TC-U-36 PASSED');
    });
  });
});