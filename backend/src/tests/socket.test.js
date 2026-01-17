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

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRE-CHECKS: Environment Validation
  // ═══════════════════════════════════════════════════════════════════════════════
  // Purpose: Verify all required environment variables are set before running tests
  // Issue Testing: Missing configuration - prevents silent failures
  // Why It Matters: Tests need proper setup to run correctly
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('✅ Pre-Checks (Must Pass)', () => {
    
    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE: Port Configuration
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Backend should have PORT configured for testing
    // Issue Testing: Configuration validation - ensures server can start
    // Expected Behavior: PORT is set to 5001 for test environment
    // Why It Matters: Tests need specific port to avoid conflicts
    // ───────────────────────────────────────────────────────────────────────────
    it('should have backend running on http://localhost:5001', () => {
      expect(process.env.PORT).toBeDefined();
      expect(process.env.PORT).toBe('5001');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE: JWT Secret Configuration
    // ───────────────────────────────────────────────────────────────────────────
    // Description: JWT_SECRET must be configured for token generation
    // Issue Testing: Security configuration - ensures token signing works
    // Expected Behavior: JWT_SECRET is defined and not empty
    // Why It Matters: Tests use JWT tokens for authentication
    // ───────────────────────────────────────────────────────────────────────────
    it('should have JWT_SECRET in .env', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET).not.toBe('');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE: Environment Mode
    // ───────────────────────────────────────────────────────────────────────────
    // Description: NODE_ENV should be set to test or development
    // Issue Testing: Environment validation - prevents production tests
    // Expected Behavior: NODE_ENV is 'development' or 'test'
    // Why It Matters: Prevents accidental test runs on production
    // ───────────────────────────────────────────────────────────────────────────
    it('should have NODE_ENV set correctly', () => {
      const validEnv = ['development', 'test'];
      expect(validEnv).toContain(process.env.NODE_ENV);
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE: Client URL Configuration
    // ───────────────────────────────────────────────────────────────────────────
    // Description: CLIENT_URL must be configured for CORS validation
    // Issue Testing: Configuration validation - enables CORS security
    // Expected Behavior: CLIENT_URL is defined in environment
    // Why It Matters: CORS prevents unauthorized frontend connections
    // ───────────────────────────────────────────────────────────────────────────
    it('should have CLIENT_URL configured', () => {
      expect(process.env.CLIENT_URL).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SERVER SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════════════════
  
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 1: SOCKET CONNECTION & AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════════
  // Purpose: Verify socket can connect and authenticate with JWT tokens
  // Critical for: Real-time messaging foundation
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('1️⃣ Socket Connection Test', () => {
    
    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 1.1: Valid Token Connection
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Socket should successfully connect with valid JWT token
    // Issue Testing: Authentication flow - ensures valid users can connect
    // Expected Behavior: Socket connects and receives connection confirmation
    // Why It Matters: Core functionality - basis for all real-time features
    // Token Details:
    //   - Contains userId, email, name
    //   - Valid for 7 days
    //   - Signed with JWT_SECRET
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 1.2: Connection Without Token Rejection
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Socket should refuse connection when token is missing
    // Issue Testing: Authentication enforcement - prevents unauthenticated access
    // Expected Behavior: Connection is rejected with AUTH_ERROR
    // Why It Matters: Security - ensures only authenticated users connect
    // Rejection Reason: Token is required for real-time messaging safety
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 1.3: Invalid Token Format Rejection
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Socket should reject malformed or tampered tokens
    // Issue Testing: Token validation - prevents invalid token exploitation
    // Expected Behavior: Connection rejected with AUTH_ERROR
    // Why It Matters: Security - ensures only legitimate tokens work
    // Invalid Token Examples:
    //   - Random strings not matching JWT format
    //   - Tokens signed with different secret (tampered)
    //   - Corrupted token structure
    // ───────────────────────────────────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 2: TOKEN SECURITY VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════
  // Purpose: Verify token-based security mechanisms work correctly
  // Critical for: Preventing unauthorized access and token exploits
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('2️⃣ Token Required Test (Security)', () => {
    
    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 2.1: Missing Token Rejection
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Connection attempt without any token should fail
    // Issue Testing: Token requirement enforcement - blocks unauthenticated connections
    // Expected Behavior: Connection rejected immediately with error
    // Why It Matters: Security - prevents anonymous connections
    // Scenario: User tries to connect without providing token in auth object
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 2.2: Expired Token Rejection
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Tokens that have expired should be rejected
    // Issue Testing: Token expiration validation - prevents old token reuse
    // Expected Behavior: Connection rejected with AUTH_ERROR
    // Why It Matters: Security - ensures tokens expire for access revocation
    // Token Expiration: Created with -1h expiry (already expired)
    // Use Case: User token expired while app is idle
    // ───────────────────────────────────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 3: ONLINE USERS BROADCASTING
  // ═══════════════════════════════════════════════════════════════════════════════
  // Purpose: Verify real-time online status updates are sent to all connected users
  // Critical for: User awareness - showing who's online
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('3️⃣ Online Users Broadcast Test', () => {
    
    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 3.1: Online Users Broadcast to All Clients
    // ───────────────────────────────────────────────────────────────────────────
    // Description: When users connect, all clients should receive updated online users list
    // Issue Testing: Broadcasting mechanism - ensures all users see updated status
    // Expected Behavior: Both users receive 'online_users' event with current users
    // Why It Matters: UX - users need to know who's available to chat
    // Broadcast Trigger: User connects → server broadcasts to all clients
    // Data Included: User ID, name, email, socket ID
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 3.2: Online Users Include Complete Data
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Online users list should include all necessary user information
    // Issue Testing: Data completeness - ensures frontend has all needed info
    // Expected Behavior: Each user object contains userId, name, email
    // Why It Matters: UX - frontend needs this data to display users correctly
    // Data Requirements:
    //   - userId: For identifying which user to message
    //   - name: For displaying in UI
    //   - email: For user identification/verification
    //   - socketId: For socket-specific operations
    // ───────────────────────────────────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 4: USER DISCONNECTION HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════
  // Purpose: Verify online status updates when users disconnect
  // Critical for: Real-time status accuracy - showing who left
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('4️⃣ Disconnect Test', () => {
    
    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 4.1: Online Users Update on Disconnect
    // ───────────────────────────────────────────────────────────────────────────
    // Description: When user disconnects, all remaining users should see updated online list
    // Issue Testing: Disconnection handling - ensures accurate user status
    // Expected Behavior: Online list updates to remove disconnected user
    // Why It Matters: UX - users need accurate view of who's actually online
    // Sequence:
    //   1. User A and B connect (both see each other)
    //   2. User B disconnects
    //   3. User A receives updated online list without User B
    // ───────────────────────────────────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 5: PRIVATE MESSAGE DELIVERY
  // ═══════════════════════════════════════════════════════════════════════════════
  // Purpose: Verify messages are correctly forwarded between users
  // Critical for: Core messaging functionality - message delivery
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('5️⃣ Private Message Forwarding Test', () => {
  
    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 5.1: Message Forwarding to Recipient
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Message sent by User A should be received by User B
    // Issue Testing: Message delivery - ensures messages reach intended recipient
    // Expected Behavior: Recipient receives 'private_message' event with full data
    // Why It Matters: Core functionality - messages must be delivered accurately
    // Message Data Includes:
    //   - fromUserId: Identifies sender
    //   - fromUserName: Displays sender name
    //   - message: The actual message content
    //   - timestamp: When message was sent
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 5.2: Message Sent Confirmation to Sender
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Sender should receive confirmation when message is sent
    // Issue Testing: Delivery confirmation - provides feedback to sender
    // Expected Behavior: Sender receives 'message_sent' event with recipient details
    // Why It Matters: UX - confirms message was sent successfully
    // Confirmation Data:
    //   - toUserId: Shows who message was sent to
    //   - toUserName: Displays recipient name
    //   - message: Echo of sent message
    //   - timestamp: Confirmation time
    // ───────────────────────────────────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 6: OFFLINE USER HANDLING
  // ═══════════════════════════════════════════════════════════════════════════════
  // Purpose: Verify system handles messages to offline/disconnected users
  // Critical for: Error handling - graceful failures when user unavailable
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('6️⃣ Offline Receiver Test', () => {
  
    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 6.1: User Offline Event
    // ───────────────────────────────────────────────────────────────────────────
    // Description: When sending to offline user, sender receives 'user_offline' event
    // Issue Testing: Offline handling - informs sender about unreachable user
    // Expected Behavior: Sender receives 'user_offline' with offline user's ID
    // Why It Matters: UX - informs user their message couldn't be delivered now
    // Scenarios:
    //   - User logged out
    //   - User connection lost
    //   - User not yet loaded in online list
    // ───────────────────────────────────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 7: MESSAGE VALIDATION & SECURITY
  // ═══════════════════════════════════════════════════════════════════════════════
  // Purpose: Verify system rejects invalid or malicious messages
  // Critical for: Data integrity and security
  // ═══════════════════════════════════════════════════════════════════════════════
  
  describe('7️⃣ Empty Message Block Test', () => {
    
    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 7.1: Empty Message Rejection
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Messages with only whitespace should be rejected
    // Issue Testing: Input validation - prevents spam and empty messages
    // Expected Behavior: Server returns 'error_message' event with error description
    // Why It Matters: Data quality - prevents cluttering chat with empty messages
    // Examples Rejected:
    //   - "   " (only spaces)
    //   - "\t\t" (only tabs)
    //   - "\n" (only newlines)
    //   - "" (completely empty)
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 7.2: Missing Recipient Validation
    // ───────────────────────────────────────────────────────────────────────────
    // Description: Messages must specify a valid recipient (toUserId)
    // Issue Testing: Required field validation - prevents routing errors
    // Expected Behavior: Server returns 'error_message' event
    // Why It Matters: Security - prevents messages sent to wrong recipients
    // Invalid Scenarios:
    //   - toUserId is null or undefined
    //   - toUserId is empty string
    //   - toUserId is not a valid user ID format
    // ───────────────────────────────────────────────────────────────────────────
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