import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';
import User from '@models/User.js';
import Message from '@models/Message.js';
import { connectDB } from '@config/db.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧪 MESSAGE PERSISTENCE & REAL-TIME DELIVERY TESTS (DAY-4)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Test Coverage:
 * A) Database Saving (Core Functionality)
 * B) Socket Real-Time Delivery
 * C) API Chat History Retrieval
 * D) Validation & Negative Cases
 * E) Multi-User Correctness
 * F) Persistence After Refresh
 * G) Stability & Crash Prevention
 */

describe('🧪 MESSAGE API & PERSISTENCE TESTS', () => {
  let userA, userB, userC;
  let tokenA, tokenB, tokenC;

  const testUsers = {
    A: {
      name: 'User A',
      email: 'userA@example.com',
      password: 'SecurePass123!'
    },
    B: {
      name: 'User B',
      email: 'userB@example.com',
      password: 'SecurePass123!'
    },
    C: {
      name: 'User C',
      email: 'userC@example.com',
      password: 'SecurePass123!'
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════════════════

  beforeAll(async () => {
    console.log('📡 Connecting to test database...');
    await connectDB();
    await User.deleteMany({});
    await Message.deleteMany({});
    console.log('✅ Test database ready');

    // Register all test users
    for (const [key, userData] of Object.entries(testUsers)) {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .timeout(15000);

      expect(registerRes.status).toBe(201);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userData.email, password: userData.password })
        .timeout(15000);

      expect(loginRes.status).toBe(200);

      // Store user data and token
      if (key === 'A') {
        userA = registerRes.body.data;
        tokenA = loginRes.body.token;
      } else if (key === 'B') {
        userB = registerRes.body.data;
        tokenB = loginRes.body.token;
      } else if (key === 'C') {
        userC = registerRes.body.data;
        tokenC = loginRes.body.token;
      }
    }

    console.log(`✅ Test users created: ${userA.name}, ${userB.name}, ${userC.name}`);
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
    await User.deleteMany({});
    await Message.deleteMany({});
    console.log('✅ Cleanup complete');
  });

  beforeEach(async () => {
    // Clear messages before each test
    await Message.deleteMany({});
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE A: DATABASE SAVING (CORE FUNCTIONALITY)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('A) DATABASE SAVING (Core Functionality)', () => {

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-01: Message saves in DB with correct fields
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-01: Message saves in DB with all required fields', async () => {
      const messageText = 'Hello from User A!';

      // Send message via API (simulating Socket.IO behavior)
      // In real scenario, this would be Socket.IO, but we test DB persistence via API
      const messageData = {
        senderId: userA._id,
        receiverId: userB._id,
        message: messageText
      };

      // Directly save to DB (simulating what socket.event.js does)
      const savedMessage = await Message.create(messageData);

      // Verify message was saved
      expect(savedMessage).toBeDefined();
      expect(savedMessage._id).toBeDefined();
      expect(savedMessage.senderId.toString()).toBe(userA._id.toString());
      expect(savedMessage.receiverId.toString()).toBe(userB._id.toString());
      expect(savedMessage.message).toBe(messageText);
      expect(savedMessage.createdAt).toBeDefined();
      expect(savedMessage.read).toBe(false);

      // Verify in database count
      const messageCount = await Message.countDocuments({
        senderId: userA._id,
        receiverId: userB._id
      });
      expect(messageCount).toBe(1);

      console.log('✅ TC-M-01 PASSED: Message saved with all required fields');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-02: Message saved with correct sender/receiver (not reversed)
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-02: Message sender and receiver are not reversed', async () => {
      const messageText = 'Test message direction';

      // A sends to B
      const savedMessage = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: messageText
      });

      // Fetch from DB
      const fetchedMessage = await Message.findById(savedMessage._id);

      // Verify direction is correct
      expect(fetchedMessage.senderId.toString()).toBe(userA._id.toString());
      expect(fetchedMessage.receiverId.toString()).toBe(userB._id.toString());
      expect(fetchedMessage.senderId.toString()).not.toBe(userB._id.toString());
      expect(fetchedMessage.receiverId.toString()).not.toBe(userA._id.toString());

      console.log('✅ TC-M-02 PASSED: Sender/receiver direction correct');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE B: SOCKET REAL-TIME DELIVERY
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('B) SOCKET REAL-TIME DELIVERY', () => {

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-03: Real-time delivery to receiver (via API simulation)
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-03: Message saved instantly and can be retrieved', async () => {
      const messageText = 'Real-time test message';

      // Save message
      const saved = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: messageText
      });

      // Receiver fetches chat history
      const response = await request(app)
        .get(`/api/v1/messages/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);

      const messageInHistory = response.body.data.find(
        m => m._id === saved._id.toString() || m._id === saved._id
      );
      expect(messageInHistory).toBeDefined();
      expect(messageInHistory.message).toBe(messageText);

      console.log('✅ TC-M-03 PASSED: Real-time message delivery works');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-04: Sender receives confirmation (message is saved)
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-04: Sender can verify message was saved', async () => {
      const messageText = 'Sender confirmation test';

      // A sends message to B
      const saved = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: messageText
      });

      // A fetches their own chat history to verify
      const response = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();

      const sentMessage = response.body.data.find(
        m => m.message === messageText
      );
      expect(sentMessage).toBeDefined();
      expect(sentMessage.message).toBe(messageText);

      console.log('✅ TC-M-04 PASSED: Sender receives confirmation');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-05: Offline user handling
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-05: Messages saved even if receiver is offline', async () => {
      const messageText = 'Message for offline user';

      // B is "offline" (not connected to socket)
      // A still sends message - should save to DB
      const saved = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: messageText
      });

      expect(saved._id).toBeDefined();

      // When B logs back in, they can fetch history
      const response = await request(app)
        .get(`/api/v1/messages/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);

      const foundMessage = response.body.data.find(
        m => m.message === messageText
      );
      expect(foundMessage).toBeDefined();

      console.log('✅ TC-M-05 PASSED: Offline messages saved correctly');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE C: API CHAT HISTORY RETRIEVAL
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('C) API CHAT HISTORY (GET /messages/:userId)', () => {

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-06: Chat history returns correct messages
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-06: Returns only messages between requested users', async () => {
      // A ↔ B: 2 messages
      await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: 'A to B: message 1'
      });

      await Message.create({
        senderId: userB._id,
        receiverId: userA._id,
        message: 'B to A: message 1'
      });

      // A ↔ C: 2 messages (should NOT appear)
      await Message.create({
        senderId: userA._id,
        receiverId: userC._id,
        message: 'A to C: message 1'
      });

      await Message.create({
        senderId: userC._id,
        receiverId: userA._id,
        message: 'C to A: message 1'
      });

      // Fetch A's chat with B
      const response = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBe(2);

      // Verify no C messages are included
      const hasUserCMessages = response.body.data.some(m => 
        m.message.includes('C')
      );
      expect(hasUserCMessages).toBe(false);

      console.log('✅ TC-M-06 PASSED: Chat history filtered correctly');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-07: Messages are ordered correctly (oldest first)
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-07: Messages sorted chronologically (old → new)', async () => {
      // Send 3 messages with delays to ensure different timestamps
      const timestamps = [];

      for (let i = 1; i <= 3; i++) {
        const msg = await Message.create({
          senderId: userA._id,
          receiverId: userB._id,
          message: `Message ${i}`
        });
        timestamps.push(msg.createdAt);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Fetch history
      const response = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(3);

      // Verify order: each timestamp >= previous
      for (let i = 1; i < response.body.data.length; i++) {
        const prevTime = new Date(response.body.data[i - 1].createdAt).getTime();
        const currTime = new Date(response.body.data[i].createdAt).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }

      console.log('✅ TC-M-07 PASSED: Messages ordered chronologically');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-08: History requires valid token (401 without token)
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-08: Rejects chat history without authentication token', async () => {
      const response = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        // NO token
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');

      console.log('✅ TC-M-08 PASSED: Unauthenticated requests rejected');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-09: Invalid token rejected
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-09: Rejects chat history with invalid token', async () => {
      const response = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', 'Bearer invalid_token_123')
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-M-09 PASSED: Invalid tokens rejected');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-10: Invalid user ID format handled gracefully
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-10: Handles invalid user ID format gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/messages/invalid_id')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      // Should return 404 or 400, not crash
      expect([400, 404]).toContain(response.status);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-M-10 PASSED: Invalid ID handled gracefully');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE D: VALIDATION & NEGATIVE CASES
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('D) VALIDATION & NEGATIVE CASES', () => {

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-11: Empty message rejected
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-11: Empty or whitespace-only messages rejected', async () => {
      const emptyMessages = ['', '   ', '\n', '\t'];

      for (const emptyMsg of emptyMessages) {
        const saved = await Message.create({
          senderId: userA._id,
          receiverId: userB._id,
          message: emptyMsg.trim()
        }).catch(err => null);

        // Should fail validation or return error
        // Check that empty message wasn't saved with content
        if (saved) {
          expect(saved.message.trim().length).toBeGreaterThan(0);
        }
      }

      console.log('✅ TC-M-11 PASSED: Empty messages handled');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-12: Very long messages (optional limit check)
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-12: Handles very long messages appropriately', async () => {
      const longMessage = 'A'.repeat(5000);

      const saved = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: longMessage
      });

      expect(saved).toBeDefined();
      expect(saved.message).toBe(longMessage);

      // Verify can be retrieved
      const fetched = await Message.findById(saved._id);
      expect(fetched.message.length).toBe(5000);

      console.log('✅ TC-M-12 PASSED: Long messages handled');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-13: Missing required fields rejected
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-13: Controller rejects missing receiverId for private message', async () => {
      const response = await request(app)
        .post('/api/v1/messages/private')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          message: 'Test message'
          // Missing receiverId
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('receiverId is required');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE E: MULTI-USER CORRECTNESS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('E) MULTI-USER CORRECTNESS', () => {

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-14: Multiple chats are not mixed
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-14: Chats with different users remain isolated', async () => {
      // A ↔ B: 3 messages
      await Message.create({ senderId: userA._id, receiverId: userB._id, message: 'A→B 1' });
      await Message.create({ senderId: userA._id, receiverId: userB._id, message: 'A→B 2' });
      await Message.create({ senderId: userA._id, receiverId: userB._id, message: 'A→B 3' });

      // A ↔ C: 2 messages
      await Message.create({ senderId: userA._id, receiverId: userC._id, message: 'A→C 1' });
      await Message.create({ senderId: userA._id, receiverId: userC._id, message: 'A→C 2' });

      // Fetch A's chat with B
      const responseB = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(responseB.body.data.length).toBe(3);

      // Fetch A's chat with C
      const responseC = await request(app)
        .get(`/api/v1/messages/${userC._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(responseC.body.data.length).toBe(2);

      // Verify B messages don't contain C content
      const hasC = responseB.body.data.some(m => m.message.includes('C'));
      expect(hasC).toBe(false);

      console.log('✅ TC-M-14 PASSED: Multi-user chats isolated');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-15: Only recipient receives message
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-15: Message only visible to sender and receiver, not others', async () => {
      const msg = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: 'Secret message A→B'
      });

      // A can see it (sender)
      const responseA = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);
      expect(responseA.body.data.some(m => m._id === msg._id.toString() || m._id === msg._id)).toBe(true);

      // B can see it (receiver)
      const responseB = await request(app)
        .get(`/api/v1/messages/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .timeout(15000);
      expect(responseB.body.data.some(m => m._id === msg._id.toString() || m._id === msg._id)).toBe(true);

      // C CANNOT see it (third party)
      const responseC = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${tokenC}`)
        .timeout(15000);
      expect(responseC.body.data.some(m => m.message === 'Secret message A→B')).toBe(false);

      console.log('✅ TC-M-15 PASSED: Message privacy enforced');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE F: PERSISTENCE AFTER REFRESH
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('F) PERSISTENCE AFTER REFRESH', () => {

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-16: Messages persist across sessions
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-16: Chat history available after browser refresh', async () => {
      // Initial exchange
      const msg1 = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: 'Message before refresh'
      });

      // "Refresh" = simulate new session (logout and login)
      // User logs in again
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUsers.A.email, password: testUsers.A.password })
        .timeout(15000);

      expect(loginRes.status).toBe(200);
      const newToken = loginRes.body.token;

      // Fetch history with new session
      const response = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${newToken}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);

      const foundMsg = response.body.data.find(
        m => m._id === msg1._id.toString() || m._id === msg1._id
      );
      expect(foundMsg).toBeDefined();
      expect(foundMsg.message).toBe('Message before refresh');

      console.log('✅ TC-M-16 PASSED: Messages persist across sessions');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-16-B: Old and new messages both appear
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-16-B: Old messages and new messages both appear together', async () => {
      // Old message
      await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: 'Old message'
      });

      // Simulate user session
      const response1 = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      // New message arrives
      await Message.create({
        senderId: userB._id,
        receiverId: userA._id,
        message: 'New message'
      });

      // Fetch again (no refresh needed - testing API consistency)
      const response2 = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response2.body.data.length).toBeGreaterThan(response1.body.data.length);
      expect(response2.body.data.some(m => m.message === 'Old message')).toBe(true);
      expect(response2.body.data.some(m => m.message === 'New message')).toBe(true);

      console.log('✅ TC-M-16-B PASSED: Old and new messages coexist');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE G: STABILITY & CRASH PREVENTION
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('G) STABILITY & CRASH PREVENTION', () => {

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-17: Server handles errors gracefully
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-17: Invalid message operations return error, not crash', async () => {
      // Try to fetch with null user ID
      const response = await request(app)
        .get('/api/v1/messages/null')
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      // Should return error response, not 500 crash
      expect([400, 404]).toContain(response.status);
      expect(response.body.success).toBe(false);

      // Server should still be alive
      const healthRes = await request(app)
        .get('/health')
        .timeout(5000);

      expect(healthRes.status).toBe(200);

      console.log('✅ TC-M-17 PASSED: Error handling prevents crashes');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-17-B: Large batch of messages handled
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-17-B: Server handles large message volume', async () => {
      // Create 100 messages quickly
      const messages = [];
      for (let i = 0; i < 100; i++) {
        messages.push({
          senderId: userA._id,
          receiverId: userB._id,
          message: `Bulk message ${i}`
        });
      }

      const saved = await Message.insertMany(messages);
      expect(saved.length).toBe(100);

      // Fetch all
      const response = await request(app)
        .get(`/api/v1/messages/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(100);

      console.log('✅ TC-M-17-B PASSED: Bulk messages handled');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-17-C: Concurrent message operations
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-17-C: Handles concurrent message operations', async () => {
      const promises = [];

      // 10 concurrent save operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          Message.create({
            senderId: userA._id,
            receiverId: userB._id,
            message: `Concurrent message ${i}`
          })
        );
      }

      const results = await Promise.all(promises);

      expect(results.length).toBe(10);
      results.forEach(msg => {
        expect(msg._id).toBeDefined();
      });

      console.log('✅ TC-M-17-C PASSED: Concurrent operations handled');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BONUS: MESSAGE READ STATUS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('BONUS: MESSAGE READ STATUS', () => {

    // ───────────────────────────────────────────────────────────────────────────
    // TC-M-BONUS-01: Mark message as read
    // ───────────────────────────────────────────────────────────────────────────
    it('TC-M-BONUS-01: Messages marked as read when fetched', async () => {
      const msg = await Message.create({
        senderId: userA._id,
        receiverId: userB._id,
        message: 'Read status test',
        read: false
      });

      expect(msg.read).toBe(false);

      // B fetches chat (should mark as read)
      const response = await request(app)
        .get(`/api/v1/messages/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .timeout(15000);

      expect(response.status).toBe(200);

      // Check if marked as read in DB
      const updated = await Message.findById(msg._id);
      expect(updated.read).toBe(true);

      console.log('✅ TC-M-BONUS-01 PASSED: Read status updated');
    });
  });
});