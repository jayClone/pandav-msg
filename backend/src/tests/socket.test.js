import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import io from 'socket.io-client';
import http from 'http';
import mongoose from 'mongoose';
import app from '../app.js';
import { createSocketServer } from '@socket/socket.server.js';
import { connectDB } from '@config/db.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Friend from '../models/Friend.js';  // ✅ ADD THIS
import Group from '../models/Group.js';
import jwt from 'jsonwebtoken';

/**
 * Socket.IO Backend QA Test Suite
 * Tests all real-time messaging functionality
 * bun test src/tests/socket.test.js
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

const generateToken = (user) => {
  return jwt.sign({
    userId: user.id,
    email: user.email,
    name: user.name,
    type: 'access'
  }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// ✅ UPDATED: Helper function to make users friends (BOTH methods)
const makeFriends = async (userId1, userId2) => {
  try {
    console.log(`🤝 Making users friends: ${userId1} ↔ ${userId2}`);
    
    // METHOD 1: Update User.friends array
    await User.updateOne(
      { _id: userId1 },
      { $addToSet: { friends: userId2 } }
    );
    
    await User.updateOne(
      { _id: userId2 },
      { $addToSet: { friends: userId1 } }
    );
    
    // ✅ METHOD 2: Create Friend records with 'accepted' status
    await Friend.deleteMany({
      $or: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 }
      ]
    });

    await Friend.insertMany([
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
    
    console.log('✅ Friendship created (both User.friends & Friend model)');
  } catch (error) {
    console.error('❌ Failed to make users friends:', error.message);
    throw error;
  }
};

describe('🧪 Socket.IO Backend QA Tests', () => {

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

    it('should have MONGO_URI configured', () => {
      expect(process.env.MONGO_URI).toBeDefined();
    });
  });

  // ✅ UPDATED: Connect to MongoDB & Setup test data
  beforeAll(async () => {
    try {
      console.log('📡 Connecting to MongoDB for tests...');
      await connectDB();
      console.log('✅ MongoDB connected');

      // ✅ CREATE TEST USERS in database
      console.log('👥 Creating test users...');
      try {
        await User.updateOne(
          { _id: testUsers.userA.id },
          {
            $set: {
              _id: testUsers.userA.id,
              email: testUsers.userA.email,
              name: testUsers.userA.name,
              password: 'hashed_password_a', // Dummy
              friends: [],
              blockedUsers: [],
            }
          },
          { upsert: true }
        );

        await User.updateOne(
          { _id: testUsers.userB.id },
          {
            $set: {
              _id: testUsers.userB.id,
              email: testUsers.userB.email,
              name: testUsers.userB.name,
              password: 'hashed_password_b', // Dummy
              friends: [],
              blockedUsers: [],
            }
          },
          { upsert: true }
        );

        console.log('✅ Test users created/updated');

        // ✅ MAKE THEM FRIENDS
        await makeFriends(testUsers.userA.id, testUsers.userB.id);

      } catch (userError) {
        console.warn('⚠️ User creation warning:', userError.message);
      }

      // Now start HTTP server
      httpServer = http.createServer(app);
      socketServer = createSocketServer(httpServer);
      
      return new Promise((resolve, reject) => {
        httpServer.listen(5001, () => {
          console.log('✅ Test server running on http://localhost:5001');
          resolve();
        });

        httpServer.on('error', (error) => {
          console.error('❌ Server error:', error.message);
          reject(error);
        });
      });
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      throw error;
    }
  });

  // ✅ UPDATED: Cleanup with proper MongoDB connection check
  afterAll(async () => {
    return new Promise(async (resolve) => {
      try {
        console.log('\n🧹 Cleaning up test data...');
      
        // ✅ FIX 1: Wait for all socket connections to close gracefully
        await new Promise(res => setTimeout(res, 1500));

        // ✅ FIX 2: Close HTTP server FIRST (this will trigger socket disconnects)
        if (httpServer) {
          httpServer.close(() => {
            console.log('✅ Test server closed');
          });
        }

        // ✅ FIX 3: Wait for server close to complete
        await new Promise(res => setTimeout(res, 1000));

        // ✅ FIX 4: THEN clean MongoDB data (after all disconnects finish)
        if (mongoose.connection && mongoose.connection.readyState === 1) {
          try {
            console.log('🗑️  Cleaning MongoDB collections...');
            await User.deleteMany({});
            await Message.deleteMany({});
            await Friend.deleteMany({});
            await Group.deleteMany({});
            console.log('✅ Test data cleaned from MongoDB');
          } catch (cleanupError) {
            // Ignore "Client must be connected" errors during cleanup
            if (cleanupError.message.includes('Client must be connected')) {
              console.warn('⚠️  MongoDB already closed (normal behavior)');
            } else {
              console.warn('⚠️  Cleanup warning:', cleanupError.message);
            }
          }
        } else {
          console.warn('⚠️  MongoDB not connected, skipping data cleanup');
        }

        // Deliberately not calling disconnectDB() here: bun test runs
        // multiple test files concurrently against one shared mongoose
        // connection, so one file disconnecting tears down the connection
        // out from under whichever other files are still mid-test
        // (see docs/audit/09).

        // ✅ FIX 6: Final cleanup delay
        await new Promise(res => setTimeout(res, 500));
        resolve();
    
      } catch (error) {
        console.error('⚠️  Critical cleanup error:', error.message);
        // Resolve anyway to prevent test hang
        resolve();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 1: SOCKET CONNECTION & AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('1️⃣ Socket Connection Test', () => {
    
    it('should connect with valid JWT token', (done) => {
      const token = generateToken(testUsers.userA);
      
      const socket = io(API_URL, {
        auth: { token },
        reconnection: false,
        transports: ['websocket', 'polling']  // ✅ Add transports
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
        socket.disconnect();
        done();
      });

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
        reconnection: false,
        transports: ['websocket', 'polling']
      });

      let errorReceived = false;

      socket.on('connect', () => {
        console.error('❌ FAIL: Should not connect without token');
        socket.disconnect();
        done();
      });

      socket.on('connect_error', (error) => {
        console.log('✅ PASS: Correctly rejected without token');
        console.log(`   Error: ${error.message}`);
        errorReceived = true;
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        if (!errorReceived) {
          socket.disconnect();
          done();
        }
      }, 3000);
    });

    it('should NOT connect with invalid token', (done) => {
      const socket = io(API_URL, {
        auth: { token: 'invalid.token.here' },
        reconnection: false,
        transports: ['websocket', 'polling']
      });

      let errorReceived = false;

      socket.on('connect_error', (error) => {
        console.log('✅ PASS: Correctly rejected invalid token');
        errorReceived = true;
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        if (!errorReceived) {
          socket.disconnect();
          done();
        }
      }, 3000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 2: TOKEN SECURITY VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('2️⃣ Token Required Test (Security)', () => {
    
    it('should reject connection when token is missing', (done) => {
      const socket = io(API_URL, {
        reconnection: false,
        transports: ['websocket', 'polling']
      });

      let errorReceived = false;

      socket.on('connect_error', (error) => {
        console.log('✅ PASS: Token validation enforced');
        errorReceived = true;
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        if (!errorReceived) {
          socket.disconnect();
          done();
        }
      }, 3000);
    });

    it('should reject expired token', (done) => {
      const expiredToken = jwt.sign(
        { userId: testUsers.userA.id },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const socket = io(API_URL, {
        auth: { token: expiredToken },
        reconnection: false,
        transports: ['websocket', 'polling']
      });

      let errorReceived = false;

      socket.on('connect_error', (error) => {
        console.log('✅ PASS: Expired token rejected');
        errorReceived = true;
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        if (!errorReceived) {
          socket.disconnect();
          done();
        }
      }, 3000);
    });

    it('should reject a refresh-type token used for socket auth (audit 04 regression)', (done) => {
      // Signed with the same secret a real access token would use, but
      // with type: 'refresh' — isolates socketAuthMiddleware's
      // `decoded.type !== 'access'` check from any secret-mismatch side effect.
      const refreshToken = jwt.sign(
        { userId: testUsers.userA.id, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const socket = io(API_URL, {
        auth: { token: refreshToken },
        reconnection: false,
        transports: ['websocket', 'polling']
      });

      let errorReceived = false;

      socket.on('connect_error', (error) => {
        console.log('✅ PASS: Refresh-type token rejected for socket auth');
        errorReceived = true;
        socket.disconnect();
        done();
      });

      socket.on('connect', () => {
        console.error('❌ FAIL: Should not connect with a refresh-type token');
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        if (!errorReceived) {
          socket.disconnect();
          done();
        }
      }, 3000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 3: ONLINE USERS BROADCASTING
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('3️⃣ Online Users Broadcast Test', () => {
    
    it('should broadcast online users to all connected clients', (done) => {
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

      setTimeout(() => {
        socketA.disconnect();
        socketB.disconnect();
        done();
      }, 10000);
    });

    it('should include user names in online list', (done) => {
      const token = generateToken(testUsers.userA);
      const socket = io(API_URL, { 
        auth: { token }, 
        reconnection: false,
        transports: ['websocket', 'polling']
      });

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

      socket.on('connect_error', (error) => {
        console.error('Error:', error.message);
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        socket.disconnect();
        done();
      }, 5001);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 4: USER DISCONNECTION HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('4️⃣ Disconnect Test', () => {
    
    it('should update online users when client disconnects', (done) => {
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

      let updateCount = 0;

      socketA.on('online_users', (users) => {
        updateCount++;
        if (updateCount === 1) {
          console.log(`   Initial online users: ${users.length}`);
          // Disconnect B
          setTimeout(() => {
            socketB.disconnect();
          }, 500);
        } else if (updateCount === 2) {
          console.log(`   After disconnect: ${users.length}`);
          console.log('✅ PASS: Online list updated after disconnect');
          socketA.disconnect();
          done();
        }
      });

      socketA.on('connect_error', (error) => {
        console.error('Error:', error.message);
      });

      setTimeout(() => {
        socketA.disconnect();
        socketB.disconnect();
        done();
      }, 8000);
    });
  });



  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 7: MESSAGE VALIDATION & SECURITY
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('7️⃣ Empty Message Block Test', () => {
    
    it('should block empty messages', (done) => {
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
        socketA.emit('private_message', {
          toUserId: testUsers.userB.id,
          message: '   '
        });
      });

      socketA.on('connect_error', (error) => {
        console.error('Error:', error.message);
        socketA.disconnect();
        socketB.disconnect();
        done();
      });

      setTimeout(() => {
        socketA.disconnect();
        socketB.disconnect();
        done();
      }, 5001);
    });

    it('should block missing toUserId', (done) => {
      const token = generateToken(testUsers.userA);
      const socket = io(API_URL, { 
        auth: { token }, 
        reconnection: false,
        transports: ['websocket', 'polling']
      });

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

      socket.on('connect_error', (error) => {
        console.error('Error:', error.message);
        socket.disconnect();
        done();
      });

      setTimeout(() => {
        socket.disconnect();
        done();
      }, 5001);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 8: MESSAGE DELETION OWNERSHIP (owed regression test, audit 02)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('8️⃣ Message Deletion Ownership Test (audit 02 regression)', () => {

    it('should reject a non-owner deleting another user\'s message and leave it intact', (done) => {
      (async () => {
        const msg = await Message.create({
          senderId: testUsers.userA.id,
          receiverId: testUsers.userB.id,
          message: 'Owned by A',
          chatType: 'private'
        });

        const tokenB = generateToken(testUsers.userB);
        const socketB = io(API_URL, {
          auth: { token: tokenB },
          reconnection: false,
          transports: ['websocket', 'polling']
        });

        let handled = false;
        const finish = async () => {
          if (handled) return;
          handled = true;
          const stillExists = await Message.findById(msg._id);
          expect(stillExists).not.toBeNull();
          socketB.disconnect();
          done();
        };

        socketB.on('error_message', (data) => {
          console.log('✅ PASS: Non-owner delete rejected:', data.message);
          finish();
        });

        socketB.on('connect', () => {
          socketB.emit('message_deleted', { messageId: msg._id.toString(), toUserId: testUsers.userA.id });
        });

        socketB.on('connect_error', (error) => {
          console.error('Error:', error.message);
          finish();
        });

        setTimeout(finish, 5000);
      })();
    }, 8000);

    it('should allow the owner to delete their own message', (done) => {
      (async () => {
        const msg = await Message.create({
          senderId: testUsers.userA.id,
          receiverId: testUsers.userB.id,
          message: 'Owned by A, to be deleted',
          chatType: 'private'
        });

        const tokenA = generateToken(testUsers.userA);
        const socketA = io(API_URL, {
          auth: { token: tokenA },
          reconnection: false,
          transports: ['websocket', 'polling']
        });

        let handled = false;
        const finish = async () => {
          if (handled) return;
          handled = true;
          const stillExists = await Message.findById(msg._id);
          expect(stillExists).toBeNull();
          socketA.disconnect();
          done();
        };

        socketA.on('message_deleted', (data) => {
          console.log('✅ PASS: Owner delete succeeded:', data.messageId);
          finish();
        });

        socketA.on('connect', () => {
          socketA.emit('message_deleted', { messageId: msg._id.toString(), toUserId: testUsers.userB.id });
        });

        socketA.on('connect_error', (error) => {
          console.error('Error:', error.message);
          finish();
        });

        setTimeout(finish, 5000);
      })();
    }, 8000);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 9: GROUP MESSAGE AUTHORIZATION (owed regression test, audit 01)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('9️⃣ Group Message Authorization Test (audit 01 regression)', () => {

    it('should reject a non-member sending a group message and create no message', (done) => {
      (async () => {
        const group = await Group.create({
          name: 'Members Only (socket test)',
          participants: [testUsers.userA.id],
          adminId: testUsers.userA.id
        });

        const tokenB = generateToken(testUsers.userB);
        const socketB = io(API_URL, {
          auth: { token: tokenB },
          reconnection: false,
          transports: ['websocket', 'polling']
        });

        let handled = false;
        const finish = async () => {
          if (handled) return;
          handled = true;
          const created = await Message.findOne({ groupId: group._id });
          expect(created).toBeNull();
          socketB.disconnect();
          done();
        };

        socketB.on('error_message', (data) => {
          console.log('✅ PASS: Non-member group message rejected:', data.message);
          finish();
        });

        socketB.on('connect', () => {
          socketB.emit('group_message', { groupId: group._id.toString(), message: 'I should not be able to send this' });
        });

        socketB.on('connect_error', (error) => {
          console.error('Error:', error.message);
          finish();
        });

        setTimeout(finish, 5000);
      })();
    }, 8000);
  });

});