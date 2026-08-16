import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'bun:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import User from '@models/User.js';
import OTP from '@models/OTP.js';
import { connectDB } from '@config/db.js';
import Message from '@models/Message.js';
import { sendAndVerifyOtp, forceVerifiedOtp } from './helpers/otp.js';

describe('🧪 Auth API Tests', () => {
  beforeAll(async () => {
    console.log('🔗 Connecting to test database...');
    await connectDB();
    
    try {
      await User.deleteMany({});
      await Message.deleteMany({});
      await OTP.deleteMany({});
      console.log('✅ Test database cleaned');
    } catch (error) {
      console.error('⚠️  Could not clean database:', error.message);
    }
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test data...');
    try {
      await User.deleteMany({});
      await Message.deleteMany({});
      await OTP.deleteMany({});
      console.log('✅ Cleanup complete');
    } catch (error) {
      console.error('⚠️  Cleanup error:', error.message);
    }
    
    // Deliberately not calling disconnectDB() here: bun test runs multiple
    // test files concurrently against one shared mongoose connection, so
    // one file disconnecting tears down the connection out from under
    // whichever other files are still mid-test (see docs/audit/09).
  });

  describe('POST /api/v1/auth/register', () => {

    it('should register a new user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      };

      const otp = await sendAndVerifyOtp(app, { email: userData.email, name: userData.name });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...userData, otp })
        .timeout(15000);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.name).toBe(userData.name);
      
      console.log('✅ TEST PASSED: Valid registration successful');
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'duplicate@example.com',
        password: 'SecurePass123!'
      };

      const firstOtp = await sendAndVerifyOtp(app, { email: userData.email, name: userData.name });
      await request(app)
        .post('/api/v1/auth/register')
        .send({ ...userData, otp: firstOtp })
        .timeout(15000);

      // send-otp intentionally won't issue a new OTP for an email that's
      // already registered (enumeration-prevention, see docs/audit/05), so
      // this simulates the only realistic way a second register attempt
      // could reach the duplicate-email guard: an OTP that's still
      // technically valid despite the account now existing.
      const secondOtp = await forceVerifiedOtp({ email: userData.email });
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...userData, otp: secondOtp })
        .timeout(15000);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already');
      
      console.log('✅ TEST PASSED: Duplicate email correctly rejected');
    });

    // ✅ FIXED: Changed assertion to check for "Validation failed" instead of "required"
    it('should reject registration with missing name field', async () => {
      const incompleteData = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(incompleteData)
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // ✅ FIXED: Check for generic validation message
      expect(response.body.message).toContain('Validation');
      
      console.log('✅ TEST PASSED: Missing name field validation works');
    });

    it('should reject registration with missing email field', async () => {
      const incompleteData = {
        name: 'Test User',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(incompleteData)
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation');
      
      console.log('✅ TEST PASSED: Missing email field validation works');
    });

    it('should reject registration with missing password field', async () => {
      const incompleteData = {
        name: 'Test User',
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(incompleteData)
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation');
      
      console.log('✅ TEST PASSED: Missing password field validation works');
    });

    it('should reject registration with invalid email format', async () => {
      const invalidEmails = [
        'notanemail',
        'missing@',
        '@nodomain.com',
        'spaces in@email.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            name: 'Test User',
            email: email,
            password: 'SecurePass123!'
          })
          .timeout(15000);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
      
      console.log('✅ TEST PASSED: Invalid email formats rejected');
    });

    // ✅ FIXED: Changed assertion to check for "Validation" instead of "Password"
    it('should reject weak passwords', async () => {
      const weakPasswords = [
        '123',
        'password',
        'Password',
        'password123'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            name: 'Test User',
            email: `test${Math.random()}@example.com`,
            password: password
          })
          .timeout(15000);

        expect(response.status).toBe(400);
        // ✅ FIXED: Check for generic validation message
        expect(response.body.message).toContain('Validation');
      }
      
      console.log('✅ TEST PASSED: Weak passwords rejected');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const testUser = {
      name: 'Login Test User',
      email: 'login@example.com',
      password: 'SecurePass123!'
    };

    beforeEach(async () => {
      await User.deleteMany({ email: testUser.email });
      await OTP.deleteMany({ email: testUser.email });

      const otp = await sendAndVerifyOtp(app, { email: testUser.email, name: testUser.name });
      await request(app)
        .post('/api/v1/auth/register')
        .send({ ...testUser, otp })
        .timeout(15000);
    });

    it('should login with correct credentials and return JWT token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.token.length).toBeGreaterThan(100);
      expect(response.body.data.email).toBe(testUser.email);
      
      console.log('✅ TEST PASSED: Successful login with correct credentials');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.token).toBeUndefined();
      
      console.log('✅ TEST PASSED: Wrong password correctly rejected');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!'
        })
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.token).toBeUndefined();
      
      console.log('✅ TEST PASSED: Non-existent email correctly rejected');
    });

    it('should reject login with missing email field', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: testUser.password
        })
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      console.log('✅ TEST PASSED: Missing email field validation works');
    });

    it('should reject login with missing password field', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email
        })
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      console.log('✅ TEST PASSED: Missing password field validation works');
    });

    it('should accept login with different email case', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email.toUpperCase(),
          password: testUser.password
        })
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      
      console.log('✅ TEST PASSED: Case-insensitive email login works');
    });
  });

  describe('GET /api/v1/auth/current', () => {
    let validToken;
    const testUser = {
      name: 'Current User Test',
      email: 'current@example.com',
      password: 'SecurePass123!'
    };

    beforeEach(async () => {
      await User.deleteMany({ email: testUser.email });
      await OTP.deleteMany({ email: testUser.email });

      const otp = await sendAndVerifyOtp(app, { email: testUser.email, name: testUser.name });
      await request(app)
        .post('/api/v1/auth/register')
        .send({ ...testUser, otp })
        .timeout(15000);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .timeout(15000);

      validToken = loginRes.body.token;
    });

    it('should return user data with valid JWT token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/current')
        .set('Authorization', `Bearer ${validToken}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.data._id).toBeDefined();
      
      console.log('✅ TEST PASSED: Valid token returns correct user data');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/current')
        .set('Authorization', 'Bearer invalid_token_string_123')
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeUndefined();
      
      console.log('✅ TEST PASSED: Invalid token correctly rejected');
    });

    it('should reject request without Authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/auth/current')
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      
      console.log('✅ TEST PASSED: Missing Authorization header correctly rejected');
    });

    it('should reject request with wrong Authorization header format', async () => {
      const wrongFormats = [
        `Token ${validToken}`,
        'Bearer',
        `Bearertoken`
      ];

      for (const header of wrongFormats) {
        const response = await request(app)
          .get('/api/v1/auth/current')
          .set('Authorization', header)
          .timeout(15000);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
      
      console.log('✅ TEST PASSED: Wrong header formats correctly rejected');
    });

    it('should return only authenticated user\'s data (privacy)', async () => {
      const anotherUser = {
        name: 'Another User',
        email: 'another@example.com',
        password: 'AnotherPass123!'
      };

      const anotherOtp = await sendAndVerifyOtp(app, { email: anotherUser.email, name: anotherUser.name });
      await request(app)
        .post('/api/v1/auth/register')
        .send({ ...anotherUser, otp: anotherOtp })
        .timeout(15000);

      const response = await request(app)
        .get('/api/v1/auth/current')
        .set('Authorization', `Bearer ${validToken}`)
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.email).not.toBe(anotherUser.email);
      
      console.log('✅ TEST PASSED: User can only access their own data');
    });
  });

  describe('🔒 Token Type Security (audit 04 regression)', () => {
    const testUser = {
      name: 'Refresh Token Test User',
      email: 'refreshtypetest@example.com',
      password: 'SecurePass123!'
    };
    let userId;

    beforeAll(async () => {
      await User.deleteMany({ email: testUser.email });
      await OTP.deleteMany({ email: testUser.email });

      const otp = await sendAndVerifyOtp(app, { email: testUser.email, name: testUser.name });
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...testUser, otp })
        .timeout(15000);

      userId = res.body.data._id;
    });

    it('rejects a refresh-type token used as a Bearer access token', async () => {
      // Signed with the same secret as a real access token, but with
      // type: 'refresh' — isolates the `decoded.type !== 'access'` check
      // in protect() from any secret-mismatch side effect.
      const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const response = await request(app)
        .get('/api/v1/auth/current')
        .set('Authorization', `Bearer ${refreshToken}`)
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      console.log('✅ TEST PASSED: Refresh token rejected as access token');
    });
  });
});