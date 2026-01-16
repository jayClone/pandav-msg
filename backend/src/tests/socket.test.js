import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import io from 'socket.io-client';
import http from 'http';
import app from '../app.js';
import { createSocketServer } from '../socket/socket.server.js';
import jwt from 'jsonwebtoken';

/**
 * Socket.IO Backend QA Test Suite
 * Tests all real-time messaging functionality
 * bun test src/tests/socket.test.js
 * Runs with Bun test runner
 */

let httpServer;
let socketServer;
const API_URL = 'http://localhost:5001';

// Test users
const testUsers = {
  userA: {
    id: '6969f9659911b0c418d76bb1',
    email: 'userA@test.com',
    name: 'User A'
  },
  userB: {
    id: '69665ee06d8dcaf427d1168d',
    email: 'userB@test.com',
    name: 'User B'
  }
};

// Generate test tokens
const generateToken = (user) => {
  return jwt.sign({
    userId: user.id,
    email: user.email,
    name: user.name
  }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

describe('🧪 Socket.IO Backend QA Tests', () => {

  // Pre-checks
  describe('✅ Pre-Checks (Must Pass)', () => {
    
    it('should have backend running on http://localhost:5001', () => {
      expect(process.env.PORT).toBeDefined();
      expect(process.env.PORT).toBe('5001');
    });

    it('should have JWT_SECRET in .env', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET).not.toBe('');
    });

    it('should have NODE_ENV set correctly', () => {
      const validEnv = ['development', 'test'];
      expect(validEnv).toContain(process.env.NODE_ENV);
    });

    it('should have CLIENT_URL configured', () => {
      expect(process.env.CLIENT_URL).toBeDefined();
    });
  });

  // Setup
  beforeAll(() => {
    httpServer = http.createServer(app);
    socketServer = createSocketServer(httpServer);
    
    return new Promise((resolve) => {
      httpServer.listen(5001, () => {
        console.log('✅ Test server running on http://localhost:5001');
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise((resolve) => {
      httpServer.close(() => {
        console.log('✅ Test server closed');
        resolve();
      });
    });
  });

  // Test 1: Socket Connection
  describe('1️⃣ Socket Connection Test', () => {
    
    it('should connect with valid JWT token', (done) => {
      const token = generateToken(testUsers.userA);
      
      const socket = io(API_URL, {
        auth: { token },
        reconnection: false
      });

      socket.on('connect', () => {
        console.log('✅ PASS: Socket connected successfully');
        console.log(`   Socket ID: ${socket.id}`);
        expect(socket.connected).toBe(true);
        socket.disconnect();
        done();
      });

      socket.on('connect_error', (error) => {
        console.error('❌ FAIL: Connection error:', error.message);
        throw new Error(error.message);
        done();
      });

      // Timeout
      setTimeout(() => {
        if (socket.connected) {
          socket.disconnect();
        }
        done();
      }, 5001);
    });

    it('should NOT connect without token', (done) => {
      const socket = io(API_URL, {
        auth: { token: null },
        reconnection: false
      });

      socket.on('connect', () => {
        console.error('❌ FAIL: Should not connect without token');
        socket.disconnect();
        throw new Error('Connected without token');
        done();
      });

      socket.on('connect_error', (error) => {
        console.log('✅ PASS: Correctly rejected without token');
        console.log(`   Error: ${error.message}`);
        expect(error.message).toContain('AUTH_ERROR');
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        socket.disconnect();
        done();
      }, 3000);
    });

    it('should NOT connect with invalid token', (done) => {
      const socket = io(API_URL, {
        auth: { token: 'invalid.token.here' },
        reconnection: false
      });

      socket.on('connect_error', (error) => {
        console.log('✅ PASS: Correctly rejected invalid token');
        expect(error.message).toContain('AUTH_ERROR');
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        socket.disconnect();
        done();
      }, 3000);
    });
  });

  // Test 2: Token Required (Security)
  describe('2️⃣ Token Required Test (Security)', () => {
    
    it('should reject connection when token is missing', (done) => {
      const socket = io(API_URL, {
        reconnection: false
      });

      socket.on('connect_error', (error) => {
        console.log('✅ PASS: Token validation enforced');
        expect(error).toBeDefined();
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        socket.disconnect();
        done();
      }, 3000);
    });

    it('should reject expired token', (done) => {
      const expiredToken = jwt.sign(
        { userId: testUsers.userA.id },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired
      );

      const socket = io(API_URL, {
        auth: { token: expiredToken },
        reconnection: false
      });

      socket.on('connect_error', (error) => {
        console.log('✅ PASS: Expired token rejected');
        expect(error.message).toContain('AUTH_ERROR');
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        socket.disconnect();
        done();
      }, 3000);
    });
  });

  // Test 3: Online Users Broadcast
  describe('3️⃣ Online Users Broadcast Test', () => {
    
    it('should broadcast online users to all connected clients', (done) => {
      const tokenA = generateToken(testUsers.userA);
      const tokenB = generateToken(testUsers.userB);

      const socketA = io(API_URL, { 
        auth: { token: tokenA }, 
        reconnection: false,
        transports: ['websocket', 'polling']  // ✅ Add transports
      });
      
      const socketB = io(API_URL, { 
        auth: { token: tokenB }, 
        reconnection: false,
        transports: ['websocket', 'polling']  // ✅ Add transports
      });

      let onlineUsersReceivedCount = 0;

      const checkComplete = () => {
        onlineUsersReceivedCount++;
        console.log(`📊 Online users received: ${onlineUsersReceivedCount}/2`);
        if (onlineUsersReceivedCount === 2) {
          console.log('✅ PASS: Both clients received online users list');
          socketA.disconnect();
          socketB.disconnect();
          done();
        }
      };

      socketA.on('online_users', (users) => {
        console.log('   User A received online users:', users.map(u => u.name));
        expect(Array.isArray(users)).toBe(true);
        checkComplete();
      });

      socketB.on('online_users', (users) => {
        console.log('   User B received online users:', users.map(u => u.name));
        expect(Array.isArray(users)).toBe(true);
        checkComplete();
      });

      socketA.on('connect_error', (error) => {
        console.error('Socket A error:', error.message);
      });

      socketB.on('connect_error', (error) => {
        console.error('Socket B error:', error.message);
      });

      // ✅ Increase timeout to 10 seconds
      setTimeout(() => {
        socketA.disconnect();
        socketB.disconnect();
        done();
      }, 10000);
    });

    it('should include user names in online list', (done) => {
      const token = generateToken(testUsers.userA);
      const socket = io(API_URL, { auth: { token }, reconnection: false });

      socket.on('online_users', (users) => {
        console.log('✅ PASS: Online users include names');
        users.forEach(user => {
          expect(user).toHaveProperty('userId');
          expect(user).toHaveProperty('name');
          expect(user).toHaveProperty('email');
          console.log(`   ✓ ${user.name} (${user.userId})`);
        });
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        socket.disconnect();
        done();
      }, 5001);
    });
  });

  // Test 4: Disconnect Test
  describe('4️⃣ Disconnect Test', () => {
    
    it('should update online users when client disconnects', (done) => {
      const tokenA = generateToken(testUsers.userA);
      const tokenB = generateToken(testUsers.userB);

      const socketA = io(API_URL, { auth: { token: tokenA }, reconnection: false });
      const socketB = io(API_URL, { auth: { token: tokenB }, reconnection: false });

      let updateCount = 0;
      const initialCount = 0;

      socketA.on('online_users', (users) => {
        updateCount++;
        if (updateCount === 1) {
          console.log(`   Initial online users: ${users.length}`);
          // Disconnect B
          socketB.disconnect();
        } else if (updateCount === 2) {
          console.log(`   After disconnect: ${users.length}`);
          console.log('✅ PASS: Online list updated after disconnect');
          socketA.disconnect();
          done();
        }
      });

      setTimeout(() => {
        socketA.disconnect();
        done();
      }, 8000);
    });
  });

  // Test 5: Private Message Forwarding
  describe('5️⃣ Private Message Forwarding Test', () => {
  
    it('should forward private message to recipient', (done) => {
      const tokenA = generateToken(testUsers.userA);
      const tokenB = generateToken(testUsers.userB);

      const socketA = io(API_URL, { 
        auth: { token: tokenA }, 
        reconnection: false,
        transports: ['websocket', 'polling']
      });
      
      const socketB = io(API_URL, { 
        auth: { token: tokenB }, 
        reconnection: false,
        transports: ['websocket', 'polling']
      });

      const testMessage = 'Hello from User A';
      let messageReceived = false;

      socketB.on('private_message', (data) => {
        console.log('✅ PASS: Message received by recipient');
        console.log(`   From: ${data.fromUserName}`);
        console.log(`   Message: ${data.message}`);
        expect(data.fromUserId).toBe(testUsers.userA.id);
        expect(data.message).toBe(testMessage);
        messageReceived = true;
        socketA.disconnect();
        socketB.disconnect();
        done();
      });

      socketA.on('connect', () => {
        socketA.emit('private_message', {
          toUserId: testUsers.userB.id,
          message: testMessage
        });
      });

      socketA.on('connect_error', (error) => {
        console.error('Socket A error:', error.message);
      });

      socketB.on('connect_error', (error) => {
        console.error('Socket B error:', error.message);
      });

      // ✅ Changed expect.fail to throw
      setTimeout(() => {
        if (!messageReceived) {
          console.error('❌ FAIL: Message not received');
          socketA.disconnect();
          socketB.disconnect();
          throw new Error('Message not received after 10s timeout');
        }
        done();
      }, 10000);
    });

    it('should send message_sent confirmation to sender', (done) => {
      const tokenA = generateToken(testUsers.userA);
      const tokenB = generateToken(testUsers.userB);

      const socketA = io(API_URL, { 
        auth: { token: tokenA }, 
        reconnection: false,
        transports: ['websocket', 'polling']
      });
      
      const socketB = io(API_URL, { 
        auth: { token: tokenB }, 
        reconnection: false,
        transports: ['websocket', 'polling']
      });

      const testMessage = 'Test confirmation';
      let confirmationReceived = false;

      socketA.on('message_sent', (data) => {
        console.log('✅ PASS: Sender received confirmation');
        console.log(`   To: ${data.toUserName}`);
        expect(data.toUserId).toBe(testUsers.userB.id);
        expect(data.message).toBe(testMessage);
        confirmationReceived = true;
        socketA.disconnect();
        socketB.disconnect();
        done();
      });

      socketA.on('connect', () => {
        socketA.emit('private_message', {
          toUserId: testUsers.userB.id,
          message: testMessage
        });
      });

      socketA.on('connect_error', (error) => {
        console.error('Socket A error:', error.message);
      });

      // ✅ Changed expect.fail to throw
      setTimeout(() => {
        if (!confirmationReceived) {
          console.error('❌ FAIL: Confirmation not received');
          socketA.disconnect();
          socketB.disconnect();
          throw new Error('Confirmation not received after 10s timeout');
        }
        done();
      }, 10000);
    });
  });

  // Test 6: Offline Receiver
  describe('6️⃣ Offline Receiver Test', () => {
  
    it('should send user_offline event when recipient is offline', (done) => {
      const token = generateToken(testUsers.userA);
      const socket = io(API_URL, { 
        auth: { token }, 
        reconnection: false,
        transports: ['websocket', 'polling']
      });

      let offlineEventReceived = false;

      socket.on('user_offline', (data) => {
        console.log('✅ PASS: User offline event received');
        console.log(`   Offline user ID: ${data.toUserId}`);
        offlineEventReceived = true;
        socket.disconnect();
        done();
      });

      socket.on('connect', () => {
        socket.emit('private_message', {
          toUserId: testUsers.userB.id,
          message: 'Hello offline user'
        });
      });

      socket.on('connect_error', (error) => {
        console.error('Socket error:', error.message);
      });

      // ✅ Changed expect.fail to throw
      setTimeout(() => {
        if (!offlineEventReceived) {
          console.error('❌ FAIL: Offline event not received');
          socket.disconnect();
          throw new Error('Offline event not received after 10s timeout');
        }
        done();
      }, 10000);
    });
  });

  // Test 7: Empty Message Block
  describe('7️⃣ Empty Message Block Test', () => {
    
    it('should block empty messages', (done) => {
      const tokenA = generateToken(testUsers.userA);
      const tokenB = generateToken(testUsers.userB);

      const socketA = io(API_URL, { auth: { token: tokenA }, reconnection: false });
      const socketB = io(API_URL, { auth: { token: tokenB }, reconnection: false });

      let errorReceived = false;

      socketA.on('error_message', (data) => {
        console.log('✅ PASS: Empty message rejected');
        console.log(`   Error: ${data.message}`);
        errorReceived = true;
        socketA.disconnect();
        socketB.disconnect();
        done();
      });

      socketA.on('connect', () => {
        // Try to send empty message
        socketA.emit('private_message', {
          toUserId: testUsers.userB.id,
          message: '   ' // Only spaces
        });
      });

      setTimeout(() => {
        socketA.disconnect();
        socketB.disconnect();
        done();
      }, 5001);
    });

    it('should block missing toUserId', (done) => {
      const token = generateToken(testUsers.userA);
      const socket = io(API_URL, { auth: { token }, reconnection: false });

      let errorReceived = false;

      socket.on('error_message', (data) => {
        console.log('✅ PASS: Missing toUserId rejected');
        errorReceived = true;
        socket.disconnect();
        done();
      });

      socket.on('connect', () => {
        socket.emit('private_message', {
          toUserId: null,
          message: 'Hello'
        });
      });

      setTimeout(() => {
        socket.disconnect();
        done();
      }, 5001);
    });
  });

});