import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';
import User from '@models/User.js';
import Group from '@models/Group.js';
import Message from '@models/Message.js';
import Friend from '@models/Friend.js';  // ✅ ADD THIS
import OTP from '@models/OTP.js';
import mongoose from 'mongoose';
import { connectDB } from '@config/db.js';
import { sendAndVerifyOtp, registerTestUser } from './helpers/otp.js';

describe('🧪 GROUP CHAT TESTS (DAY-5)', () => {
  let userA, userB, userC, userD;
  let tokenA, tokenB, tokenC, tokenD;
  let groupId1;

  const testUsers = {
    A: { name: 'Alice', email: 'alice@example.com', password: 'SecurePass123!' },
    B: { name: 'Bob', email: 'bob@example.com', password: 'SecurePass123!' },
    C: { name: 'Charlie', email: 'charlie@example.com', password: 'SecurePass123!' },
    D: { name: 'David', email: 'david@example.com', password: 'SecurePass123!' }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER: Create friendship directly in database
  // ═══════════════════════════════════════════════════════════════════════════════

  const makeFriendsDirectly = async (userId1, userId2) => {
    try {
      console.log(`\n🤝 Creating direct friendship: ${userId1} ↔ ${userId2}`);
      
      // Delete existing records
      await Friend.deleteMany({
        $or: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 }
        ]
      });

      // Create bidirectional friendship
      await Friend.create([
        {
          senderId: userId1,
          receiverId: userId2,
          status: 'accepted',
          acceptedAt: new Date()
        },
        {
          senderId: userId2,
          receiverId: userId1,
          status: 'accepted',
          acceptedAt: new Date()
        }
      ]);

      console.log(`✅ Friendship created\n`);
    } catch (error) {
      console.error('❌ Failed to create friendship:', error.message);
      throw error;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════════════════

  beforeAll(async () => {
    console.log('\n📡 Connecting to test database...');
    await connectDB();
    await User.deleteMany({});
    await Group.deleteMany({});
    await Message.deleteMany({});
    await Friend.deleteMany({});  // ✅ ADD THIS
    await OTP.deleteMany({});
    console.log('✅ Test database ready\n');

    // Register all test users
    for (const [key, userData] of Object.entries(testUsers)) {
      const otp = await sendAndVerifyOtp(app, { email: userData.email, name: userData.name });
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...userData, otp })
        .timeout(15000);

      expect(registerRes.status).toBe(201);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userData.email, password: userData.password })
        .timeout(15000);

      expect(loginRes.status).toBe(200);

      if (key === 'A') {
        userA = registerRes.body.data;
        tokenA = loginRes.body.token;
      } else if (key === 'B') {
        userB = registerRes.body.data;
        tokenB = loginRes.body.token;
      } else if (key === 'C') {
        userC = registerRes.body.data;
        tokenC = loginRes.body.token;
      } else if (key === 'D') {
        userD = registerRes.body.data;
        tokenD = loginRes.body.token;
      }
    }

    // ✅ FIX: Create friendships directly in database
    console.log('🤝 Creating friendships...');
    
    await makeFriendsDirectly(userA._id, userB._id);
    await makeFriendsDirectly(userA._id, userC._id);
    await makeFriendsDirectly(userA._id, userD._id);
    await makeFriendsDirectly(userB._id, userC._id);
    await makeFriendsDirectly(userB._id, userD._id);
    await makeFriendsDirectly(userC._id, userD._id);

    console.log(`✅ All friendships created\n`);
    console.log(`✅ Test users ready: ${userA.name}, ${userB.name}, ${userC.name}, ${userD.name}\n`);
  }, 30000); // 4 sequential real OTP send/verify/register/login round-trips need more than the default hook timeout

  afterAll(async () => {
    console.log('\n🧹 Cleaning up test data...');
    await User.deleteMany({});
    await Group.deleteMany({});
    await Message.deleteMany({});
    await Friend.deleteMany({});  // ✅ ADD THIS
    await OTP.deleteMany({});
    // Deliberately not calling disconnectDB() here: bun test runs multiple
    // test files concurrently against one shared mongoose connection, so
    // one file disconnecting tears down the connection out from under
    // whichever other files are still mid-test (see docs/audit/09).
    console.log('✅ Cleanup complete\n');
  });

  beforeEach(async () => {
    await Group.deleteMany({});
    await Message.deleteMany({});
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE A: GROUP CREATION (API)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('A) GROUP CREATION (API)', () => {

    it('TC-G-01: Create group successfully with valid name + members', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Project Team',
          memberIds: [userB._id.toString(), userC._id.toString()]
        })
        .timeout(15000);

      console.log(`[TC-G-01] Status: ${response.status}`);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBeDefined();
      expect(response.body.data.name).toBe('Project Team');
      expect(response.body.data.adminId._id.toString()).toBe(userA._id.toString());
      expect(response.body.data.participants.length).toBe(3);
      expect(response.body.data.participants.map(p => p._id.toString())).toContain(userA._id.toString());

      groupId1 = response.body.data._id;
      console.log('✅ TC-G-01 PASSED\n');
    });

    it('TC-G-03: Duplicate members removed', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Duplicate Test',
          memberIds: [userB._id.toString(), userC._id.toString(), userB._id.toString(), userC._id.toString()]
        })
        .timeout(15000);

      console.log(`[TC-G-03] Status: ${response.status}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.participants.length).toBe(3);

      const dbGroup = await Group.findById(response.body.data._id);
      const uniqueIds = new Set(dbGroup.participants.map(p => p.toString()));
      expect(uniqueIds.size).toBe(dbGroup.participants.length);
      console.log('✅ TC-G-03 PASSED\n');
    });

    it('TC-G-06: Creator automatically included', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Auto Creator', memberIds: [userB._id.toString()] })
        .timeout(15000);

      console.log(`[TC-G-06] Status: ${response.status}`);

      expect(response.status).toBe(201);
      const participantIds = response.body.data.participants.map(p => p._id.toString());
      expect(participantIds).toContain(userA._id.toString());
      expect(participantIds).toContain(userB._id.toString());
      console.log('✅ TC-G-06 PASSED\n');
    });

    it('TC-G-07: Creator becomes admin', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Admin Test', memberIds: [userB._id.toString()] })
        .timeout(15000);

      console.log(`[TC-G-07] Status: ${response.status}`);

      expect(response.status).toBe(201);
      expect(response.body.data.adminId._id.toString()).toBe(userA._id.toString());
      console.log('✅ TC-G-07 PASSED\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE B: GROUP LIST (API)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('B) GROUP LIST (API)', () => {

    it('TC-G-09: Get my groups returns groups where user is member', async () => {
      const group1 = await Group.create({
        name: 'Group 1',
        participants: [userA._id, userB._id],
        adminId: userA._id
      });

      const group2 = await Group.create({
        name: 'Group 2',
        participants: [userA._id, userC._id],
        adminId: userA._id
      });

      await Group.create({
        name: 'Group 3',
        participants: [userB._id, userC._id],
        adminId: userB._id
      });

      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data.map(g => g._id)).toContain(group1._id.toString());
      expect(response.body.data.map(g => g._id)).toContain(group2._id.toString());

      console.log('✅ TC-G-09 PASSED\n');
    });

    it('TC-G-10: Get my groups returns empty when user has no groups', async () => {
      await Group.create({
        name: 'Group Without D',
        participants: [userA._id, userB._id],
        adminId: userA._id
      });

      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenD}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toEqual([]);

      console.log('✅ TC-G-10 PASSED\n');
    });

    it('TC-G-11: Cannot get groups without authentication token', async () => {
      const response = await request(app)
        .get('/api/v1/groups')
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-G-11 PASSED\n');
    });

    it('TC-G-12: Groups sorted by creation date (newest first)', async () => {
      const group1 = await Group.create({
        name: 'Old Group',
        participants: [userA._id, userB._id],
        adminId: userA._id
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const group2 = await Group.create({
        name: 'New Group',
        participants: [userA._id, userB._id],
        adminId: userA._id
      });

      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data[0]._id.toString()).toBe(group2._id.toString());
      expect(response.body.data[1]._id.toString()).toBe(group1._id.toString());

      console.log('✅ TC-G-12 PASSED\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE C: GROUP MESSAGE HISTORY (REST)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('C) GROUP MESSAGE HISTORY (REST)', () => {

    let testGroup;

    beforeEach(async () => {
      testGroup = await Group.create({
        name: 'Message Test Group',
        participants: [userA._id, userB._id, userC._id],
        adminId: userA._id
      });
    });

    it('TC-G-13: Member can fetch group message history', async () => {
      await Message.create({
        senderId: userA._id,
        groupId: testGroup._id,
        message: 'Hello group!',
        chatType: 'group'
      });

      await Message.create({
        senderId: userB._id,
        groupId: testGroup._id,
        message: 'Hi from B!',
        chatType: 'group'
      });

      const response = await request(app)
        .get(`/api/v1/groups/${testGroup._id}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data[0].message).toBe('Hello group!');
      expect(response.body.data[1].message).toBe('Hi from B!');

      console.log('✅ TC-G-13 PASSED\n');
    });

    it('TC-G-14: Non-member cannot fetch group history', async () => {
      const response = await request(app)
        .get(`/api/v1/groups/${testGroup._id}/messages`)
        .set('Authorization', `Bearer ${tokenD}`)
        .timeout(15000);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not a member');

      console.log('✅ TC-G-14 PASSED\n');
    });

    it('TC-G-15: Messages ordered chronologically (old → new)', async () => {
      for (let i = 1; i <= 3; i++) {
        await Message.create({
          senderId: userA._id,
          groupId: testGroup._id,
          message: `Message ${i}`,
          chatType: 'group'
        });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const response = await request(app)
        .get(`/api/v1/groups/${testGroup._id}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(3);
      expect(response.body.data[0].message).toBe('Message 1');
      expect(response.body.data[1].message).toBe('Message 2');
      expect(response.body.data[2].message).toBe('Message 3');

      console.log('✅ TC-G-15 PASSED\n');
    });

    it('TC-G-16: History limit works (cursor-based pagination)', async () => {
      // getGroupMessages uses cursor pagination (`before` + `limit`), not
      // page numbers — `page` is accepted but only echoed back, it doesn't
      // change which messages come back. This test previously asserted a
      // `totalPages` field that has never existed on this response and
      // re-requested with `page=2` (which the endpoint ignores), so it was
      // testing an API shape this endpoint never actually had.
      // Explicit, distinct createdAt per message: insertMany runs as one
      // bulk write, so without this every document would get effectively
      // the same auto-timestamp and the createdAt-sort tie-order between
      // page 1 and page 2 wouldn't be guaranteed stable.
      const baseTime = Date.now();
      const messages = [];
      for (let i = 0; i < 100; i++) {
        messages.push({
          senderId: userA._id,
          groupId: testGroup._id,
          message: `Message ${i}`,
          chatType: 'group',
          createdAt: new Date(baseTime + i)
        });
      }
      await Message.insertMany(messages);

      const response1 = await request(app)
        .get(`/api/v1/groups/${testGroup._id}/messages?limit=50`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response1.body.data.length).toBe(50);
      expect(response1.body.totalCount).toBe(100);
      expect(response1.body.hasMore).toBe(true);
      expect(response1.body.nextCursor).toBeDefined();

      const response2 = await request(app)
        .get(`/api/v1/groups/${testGroup._id}/messages?limit=50&before=${response1.body.nextCursor}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response2.body.data.length).toBe(50);
      expect(response2.body.hasMore).toBe(false);

      // The two pages shouldn't overlap
      const idsPage1 = new Set(response1.body.data.map(m => m._id));
      const idsPage2 = new Set(response2.body.data.map(m => m._id));
      const overlap = [...idsPage1].filter(id => idsPage2.has(id));
      expect(overlap.length).toBe(0);

      console.log('✅ TC-G-16 PASSED\n');
    });

    it('TC-G-17: Invalid groupId handled gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/groups/invalid_id/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect([400, 404]).toContain(response.status);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-G-17 PASSED\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE E: SOCKET GROUP MESSAGING (Realtime + DB)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('E) SOCKET GROUP MESSAGING (Realtime + DB)', () => {

    let testGroup;

    beforeEach(async () => {
      testGroup = await Group.create({
        name: 'Messaging Test Group',
        participants: [userA._id, userB._id, userC._id],
        adminId: userA._id
      });
    });

    it('TC-G-22: Group message saved to DB with correct fields', async () => {
      const savedMsg = await Message.create({
        senderId: userA._id,
        groupId: testGroup._id,
        message: 'Group message test',
        chatType: 'group'
      });

      expect(savedMsg._id).toBeDefined();
      expect(savedMsg.senderId.toString()).toBe(userA._id.toString());
      expect(savedMsg.groupId.toString()).toBe(testGroup._id.toString());
      expect(savedMsg.message).toBe('Group message test');
      expect(savedMsg.chatType).toBe('group');

      console.log('✅ TC-G-22 PASSED\n');
    });

    it('TC-G-26: Multiple fast messages maintain order', async () => {
      const messages = [];
      for (let i = 1; i <= 5; i++) {
        messages.push({
          senderId: userA._id,
          groupId: testGroup._id,
          message: `Fast message ${i}`,
          chatType: 'group'
        });
      }

      const saved = await Message.insertMany(messages);
      expect(saved.length).toBe(5);

      const fetched = await Message.find({
        groupId: testGroup._id,
        chatType: 'group'
      }).sort({ createdAt: 1 });

      expect(fetched.length).toBe(5);
      for (let i = 0; i < fetched.length; i++) {
        expect(fetched[i].message).toContain(`Fast message ${i + 1}`);
      }

      console.log('✅ TC-G-26 PASSED\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE G: BASIC SAFETY / STABILITY
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('G) BASIC SAFETY / STABILITY', () => {

    it('TC-G-32: Invalid group operations handled gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/groups/invalid_id')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect([400, 404]).toContain(response.status);

      console.log('✅ TC-G-32 PASSED\n');
    });

    it('TC-G-33: Large group creation handled', async () => {
      const memberIds = [userB._id.toString(), userC._id.toString(), userD._id.toString()];

      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Large Group',
          memberIds: memberIds
        })
        .timeout(15000);

      console.log(`[TC-G-33] Status: ${response.status}`);

      expect(response.status).toBe(201);

      console.log('✅ TC-G-33 PASSED\n');
    });

    it('TC-G-34: Concurrent group operations', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          Group.create({
            name: `Concurrent Group ${i}`,
            participants: [userA._id, userB._id],
            adminId: userA._id
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
      results.forEach(group => {
        expect(group._id).toBeDefined();
      });

      console.log('✅ TC-G-34 PASSED\n');
    });

    it('TC-G-35: Mixed group operations', async () => {
      const group = await Group.create({
        name: 'Mixed Ops Group',
        participants: [userA._id, userB._id],
        adminId: userA._id
      });

      const message = await Message.create({
        senderId: userA._id,
        groupId: group._id,
        message: 'Test message',
        chatType: 'group'
      });

      group.participants.push(userC._id);
      await group.save();

      const fetched = await Group.findById(group._id);
      expect(fetched.participants.length).toBe(3);

      console.log('✅ TC-G-35 PASSED\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BONUS: ADMIN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('BONUS: ADMIN OPERATIONS', () => {

    let testGroup;

    beforeEach(async () => {
      testGroup = await Group.create({
        name: 'Admin Test Group',
        participants: [userA._id, userB._id, userC._id],
        adminId: userA._id
      });
    });

    it('TC-G-BONUS-01: Only admin can add members', async () => {
      const response = await request(app)
        .post(`/api/v1/groups/${testGroup._id}/members`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ userId: userD._id.toString() })
        .timeout(15000);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('admin');

      console.log('✅ TC-G-BONUS-01 PASSED\n');
    });

    it('TC-G-BONUS-02: Admin can add member', async () => {
      const response = await request(app)
        .post(`/api/v1/groups/${testGroup._id}/members`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userD._id.toString() })
        .timeout(15000);

      console.log(`[TC-G-BONUS-02] Status: ${response.status}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.participants.length).toBe(4);

      console.log('✅ TC-G-BONUS-02 PASSED\n');
    });

    it('TC-G-BONUS-03: Cannot add duplicate member', async () => {
      const response = await request(app)
        .post(`/api/v1/groups/${testGroup._id}/members`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: userB._id.toString() })
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already');

      console.log('✅ TC-G-BONUS-03 PASSED\n');
    });

    it('TC-G-BONUS-04: Admin can remove member', async () => {
      const response = await request(app)
        .delete(`/api/v1/groups/${testGroup._id}/members`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ memberId: userB._id.toString() })
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.participants.length).toBe(2);

      console.log('✅ TC-G-BONUS-04 PASSED\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // LEAVE GROUP FEATURE
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('F) LEAVE GROUP FEATURE', () => {
    let groupA, user1, user2, user3, token1, token2, token3;

    beforeEach(async () => {
      await Group.deleteMany({});
      await Message.deleteMany({});

      // Reuse main test users (already have friendships)
      user1 = userA;
      user2 = userB;
      user3 = userC;
      token1 = tokenA;
      token2 = tokenB;
      token3 = tokenC;

      const groupRes = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          name: 'Leave Test Group',
          memberIds: [user2._id.toString(), user3._id.toString()]
        })
        .timeout(15000);

      if (!groupRes.body.data) {
        console.error('Group creation error:', groupRes.body);
        throw new Error(`Group creation failed: ${JSON.stringify(groupRes.body)}`);
      }

      groupA = groupRes.body.data;
      console.log('✅ Group created for leave tests\n');
    });

    it('TC-G-36: Member can leave group', async () => {
      const response = await request(app)
        .post(`/api/v1/groups/${groupA._id}/leave`)
        .set('Authorization', `Bearer ${token2}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('left the group');

      const participantIds = response.body.data.participants.map(p => p._id || p);
      expect(participantIds.some(id => id.toString() === user2._id.toString())).toBe(false);

      console.log('✅ TC-G-36 PASSED\n');
    });

    it('TC-G-37: Non-member cannot leave group', async () => {
      const otherUserReg = await registerTestUser(app, {
        name: 'Other User Leave',
        email: 'otherleave@example.com',
        password: 'Other123!'
      });

      if (!otherUserReg.body.data) {
        throw new Error('Other user registration failed');
      }

      const otherToken = otherUserReg.body.token;

      const response = await request(app)
        .post(`/api/v1/groups/${groupA._id}/leave`)
        .set('Authorization', `Bearer ${otherToken}`)
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not a member');

      console.log('✅ TC-G-37 PASSED\n');
    });

    it('TC-G-38: Admin cannot leave if last member', async () => {
      await request(app)
        .delete(`/api/v1/groups/${groupA._id}/members`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ memberId: user2._id.toString() })
        .timeout(15000);

      await request(app)
        .delete(`/api/v1/groups/${groupA._id}/members`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ memberId: user3._id.toString() })
        .timeout(15000);

      const response = await request(app)
        .post(`/api/v1/groups/${groupA._id}/leave`)
        .set('Authorization', `Bearer ${token1}`)
        .timeout(15000);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cannot leave an empty group');

      console.log('✅ TC-G-38 PASSED\n');
    });

    it('TC-G-39: Admin reassigned when admin leaves', async () => {
      const response = await request(app)
        .post(`/api/v1/groups/${groupA._id}/leave`)
        .set('Authorization', `Bearer ${token1}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const newAdminId = response.body.data.adminId._id || response.body.data.adminId;
      const participantIds = response.body.data.participants.map(p => p._id || p);

      expect(participantIds.some(id => id.toString() === newAdminId.toString())).toBe(true);
      expect(newAdminId.toString()).not.toBe(user1._id.toString());

      console.log('✅ TC-G-39 PASSED\n');
    });

it('TC-G-40: Leave reduces participant count', async () => {
  const initialCount = groupA.participants.length;

  const response = await request(app)
    .post(`/api/v1/groups/${groupA._id}/leave`)
    .set('Authorization', `Bearer ${token2}`)  // ✅ FIX: Changed "Bear" to "Bearer"
    .timeout(15000);

  expect(response.status).toBe(200);
  expect(response.body.data.participants.length).toBe(initialCount - 1);

  console.log('✅ TC-G-40 PASSED\n');
});

    it('TC-G-41: Invalid group ID rejected', async () => {
      const response = await request(app)
        .post('/api/v1/groups/invalid_id/leave')
        .set('Authorization', `Bearer ${token1}`)
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');

      console.log('✅ TC-G-41 PASSED\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // DELETE GROUP FEATURE
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('H) DELETE GROUP FEATURE', () => {

    let testGroup, deleteTestUserA, deleteTestUserB, deleteTokenA, deleteTokenB;

    beforeAll(async () => {
      const regA = await registerTestUser(app, {
        name: 'Delete Test User A',
        email: 'deletetestA@example.com',
        password: 'DeleteTest123!'
      });

      if (!regA.body.data) {
        throw new Error('User A registration failed for delete tests');
      }

      deleteTestUserA = regA.body.data;
      deleteTokenA = regA.body.token;

      const regB = await registerTestUser(app, {
        name: 'Delete Test User B',
        email: 'deletetestB@example.com',
        password: 'DeleteTest123!'
      });

      if (!regB.body.data) {
        throw new Error('User B registration failed for delete tests');
      }

      deleteTestUserB = regB.body.data;
      deleteTokenB = regB.body.token;

      // ✅ Create friendship between delete test users
      await makeFriendsDirectly(deleteTestUserA._id, deleteTestUserB._id);
    }, 20000); // 2 sequential real OTP round-trips need more than the default hook timeout

    beforeEach(async () => {
      testGroup = await Group.create({
        name: 'Temporary Group',
        participants: [deleteTestUserA._id, deleteTestUserB._id],
        adminId: deleteTestUserA._id
      });
    });

    it('TC-G-42: Admin can delete group successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/groups/${testGroup._id}`)
        .set('Authorization', `Bearer ${deleteTokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.groupId).toBe(testGroup._id.toString());
      
      const groupExists = await Group.findById(testGroup._id);
      expect(groupExists).toBeNull();

      console.log('✅ TC-G-42 PASSED\n');
    });

    it('TC-G-43: Non-admin cannot delete group', async () => {
      const response = await request(app)
        .delete(`/api/v1/groups/${testGroup._id}`)
        .set('Authorization', `Bearer ${deleteTokenB}`)
        .timeout(15000);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only admin');

      console.log('✅ TC-G-43 PASSED\n');
    });

    it('TC-G-44: Deleting group removes all its messages', async () => {
      await Message.create({
        senderId: deleteTestUserA._id,
        groupId: testGroup._id,
        message: 'Test message 1',
        chatType: 'group'
      });

      await Message.create({
        senderId: deleteTestUserB._id,
        groupId: testGroup._id,
        message: 'Test message 2',
        chatType: 'group'
      });

      let messageCount = await Message.countDocuments({
        groupId: testGroup._id
      });
      expect(messageCount).toBe(2);

      const response = await request(app)
        .delete(`/api/v1/groups/${testGroup._id}`)
        .set('Authorization', `Bearer ${deleteTokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data.messagesDeleted).toBe(2);

      messageCount = await Message.countDocuments({
        groupId: testGroup._id
      });
      expect(messageCount).toBe(0);

      console.log('✅ TC-G-44 PASSED\n');
    });

    it('TC-G-45: Cannot delete non-existent group', async () => {
      const fakeGroupId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/v1/groups/${fakeGroupId}`)
        .set('Authorization', `Bearer ${deleteTokenA}`)
        .timeout(15000);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Group not found');

      console.log('✅ TC-G-45 PASSED\n');
    });

    it('TC-G-46: Invalid groupId format rejected', async () => {
      const response = await request(app)
        .delete(`/api/v1/groups/invalid-id`)
        .set('Authorization', `Bearer ${deleteTokenA}`)
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid group ID format');

      console.log('✅ TC-G-46 PASSED\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // I) AUTHORIZATION — Non-member group posting (owed regression test, audit 01)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('I) AUTHORIZATION — Non-member group posting (audit 01 regression)', () => {
    let memberGroup, outsider, outsiderToken;

    beforeAll(async () => {
      const outsiderReg = await registerTestUser(app, {
        name: 'Outsider',
        email: 'outsider-groupauth@example.com',
        password: 'Outsider123!'
      });
      outsider = outsiderReg.body.data;
      outsiderToken = outsiderReg.body.token;
    }, 15000);

    // The outer describe's beforeEach wipes the Group collection before
    // every test in this file, so memberGroup has to be (re)created here
    // rather than in beforeAll or it won't exist by the time this test runs.
    beforeEach(async () => {
      memberGroup = await Group.create({
        name: 'Members Only Group',
        participants: [userA._id, userB._id],
        adminId: userA._id
      });
    });

    it('TC-G-47: REST — non-member posting to a group is rejected with 403 and no message is created', async () => {
      const response = await request(app)
        .post('/api/v1/messages/group')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ groupId: memberGroup._id.toString(), message: 'I should not be able to send this' })
        .timeout(15000);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      const created = await Message.findOne({ groupId: memberGroup._id, senderId: outsider._id });
      expect(created).toBeNull();

      console.log('✅ TC-G-47 PASSED\n');
    });
  });
});