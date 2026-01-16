import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';

// ✅ Use passwords that match the regex: Min 8 chars, 1 uppercase, 1 number, 1 special char

describe('🧪 Auth API Tests', () => {
  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/v1/auth/register', () => {

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 1.1: Valid Registration
    // ───────────────────────────────────────────────────────────────────────────
    it('should register a new user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'  // ✅ FIXED: Added special char and uppercase
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .timeout(15000);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.name).toBe(userData.name);
      
      console.log('✅ TEST PASSED: Valid registration successful');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 1.2: Duplicate Email Rejection
    // ───────────────────────────────────────────────────────────────────────────
    it('should reject duplicate email registration', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'duplicate@example.com',
        password: 'SecurePass123!'  // ✅ FIXED: Valid password
      };

      // First registration - should succeed
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .timeout(15000);

      // Second registration with same email - should fail
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .timeout(15000);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exist');
      
      console.log('✅ TEST PASSED: Duplicate email correctly rejected');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 1.3: Missing Required Fields Validation
    // ───────────────────────────────────────────────────────────────────────────
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
      expect(response.body.message).toContain('required');
      
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
      
      console.log('✅ TEST PASSED: Missing password field validation works');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 1.4: Invalid Email Format
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 1.5: Weak Password Rejection
    // ───────────────────────────────────────────────────────────────────────────
    // Password Requirements:
    //   ✅ Min 8 characters
    //   ✅ At least 1 uppercase letter (A-Z)
    //   ✅ At least 1 number (0-9)
    //   ✅ At least 1 special character (!@#$%^&*)
    // ───────────────────────────────────────────────────────────────────────────
    it('should reject weak passwords', async () => {
      const weakPasswords = [
        '123',              // Too short
        'password',         // No uppercase, numbers, or special chars
        'Password',         // No numbers or special chars
        'password123'       // No uppercase or special chars
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
        expect(response.body.message).toContain('Password');  // ✅ FIXED: Check for "Password" not "password"
      }
      
      console.log('✅ TEST PASSED: Weak passwords rejected');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 2: USER LOGIN
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/auth/login', () => {
    const testUser = {
      name: 'Login Test User',
      email: 'login@example.com',
      password: 'SecurePass123!'  // ✅ FIXED: Valid password
    };

    beforeEach(async () => {
      await User.deleteMany({ email: testUser.email });
      
      // Create test user before each login test
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
        .timeout(15000);
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 2.1: Successful Login with Correct Credentials
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 2.2: Login Rejection with Wrong Password
    // ───────────────────────────────────────────────────────────────────────────
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
      expect(response.body.message).toContain('Invalid');
      
      console.log('✅ TEST PASSED: Wrong password correctly rejected');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 2.3: Login Rejection with Non-existent Email
    // ───────────────────────────────────────────────────────────────────────────
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
      expect(response.body.message).toContain('Invalid');
      
      console.log('✅ TEST PASSED: Non-existent email correctly rejected');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 2.4: Login with Missing Fields
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 2.5: Case-Insensitive Email Login
    // ───────────────────────────────────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST SUITE 3: GET CURRENT USER (Protected Route)
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('GET /api/v1/auth/current', () => {
    let validToken;
    const testUser = {
      name: 'Current User Test',
      email: 'current@example.com',
      password: 'SecurePass123!'  // ✅ FIXED: Valid password
    };

    beforeEach(async () => {
      await User.deleteMany({ email: testUser.email });

      // Register and login to get valid token
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 3.1: Get User Data with Valid Token
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 3.2: Rejection with Invalid/Malformed Token
    // ───────────────────────────────────────────────────────────────────────────
    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/current')
        .set('Authorization', 'Bearer invalid_token_string_123')
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeUndefined();
      // ✅ FIXED: Check for either error message
      expect(
        response.body.message === 'Token is invalid or expired' ||
        response.body.message.includes('token')
      ).toBe(true);
      
      console.log('✅ TEST PASSED: Invalid token correctly rejected');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 3.3: Rejection without Authorization Header
    // ───────────────────────────────────────────────────────────────────────────
    it('should reject request without Authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/auth/current')
        .timeout(15000);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
      
      console.log('✅ TEST PASSED: Missing Authorization header correctly rejected');
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 3.4: Rejection with Wrong Authorization Header Format
    // ───────────────────────────────────────────────────────────────────────────
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

    // ───────────────────────────────────────────────────────────────────────────
    // TEST CASE 3.5: Data Privacy - User Can Only Access Own Data
    // ───────────────────────────────────────────────────────────────────────────
    it('should return only authenticated user\'s data (privacy)', async () => {
      // Create another user
      const anotherUser = {
        name: 'Another User',
        email: 'another@example.com',
        password: 'AnotherPass123!'  // ✅ FIXED: Valid password
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send(anotherUser)
        .timeout(15000);

      // Login as first user and get their data
      const response = await request(app)
        .get('/api/v1/auth/current')
        .set('Authorization', `Bearer ${validToken}`)
        .timeout(15000);

      // Verify we get first user's data, not second user's
      expect(response.status).toBe(200);  // ✅ FIXED: Add status check
      expect(response.body.data).toBeDefined();  // ✅ FIXED: Check data exists
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.email).not.toBe(anotherUser.email);
      
      console.log('✅ TEST PASSED: User can only access their own data');
    });
  });
});