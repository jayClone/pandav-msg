import { describe, it, beforeAll, afterAll, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';
import User from '@models/User.js';
import OTP from '@models/OTP.js';
import { connectDB } from '@config/db.js';
import { registerTestUser } from './helpers/otp.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧪 OTP ENDPOINT TESTS (owed regression tests, audit 05)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * - send-otp must return an identical response shape/status for an existing
 *   vs. non-existing account, for both the 'login' and 'registration'
 *   purposes, so the endpoint can't be used to enumerate registered emails.
 * - `purpose` must be restricted to a fixed enum by Joi so a NoSQL operator
 *   payload like {"$ne":"x"} is rejected as a validation error rather than
 *   ever reaching a Mongo query.
 */
describe('🧪 OTP API TESTS', () => {
  const existingUser = {
    name: 'OTP Existing User',
    email: 'otp-existing@example.com',
    password: 'SecurePass123!'
  };
  const nonExistingEmail = 'otp-nonexisting@example.com';

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await OTP.deleteMany({});

    await registerTestUser(app, existingUser);
  }, 20000);

  afterAll(async () => {
    await User.deleteMany({});
    await OTP.deleteMany({});
    // Deliberately not calling disconnectDB() here: bun test runs multiple
    // test files concurrently against one shared mongoose connection, so
    // one file disconnecting tears down the connection out from under
    // whichever other files are still mid-test (see docs/audit/09).
  });

  describe('A) ENUMERATION PREVENTION — POST /api/v1/otp/send-otp', () => {

    it('TC-OTP-01: registration purpose returns identical shape for existing and non-existing emails', async () => {
      const resExisting = await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: existingUser.email, name: 'Whoever', purpose: 'registration' })
        .timeout(15000);

      const resNonExisting = await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: nonExistingEmail, name: 'Whoever', purpose: 'registration' })
        .timeout(15000);

      expect(resExisting.status).toBe(200);
      expect(resNonExisting.status).toBe(200);
      expect(resExisting.body.success).toBe(true);
      expect(resNonExisting.body.success).toBe(true);
      expect(Object.keys(resExisting.body.data).sort()).toEqual(Object.keys(resNonExisting.body.data).sort());

      console.log('✅ TC-OTP-01 PASSED');
    });

    it('TC-OTP-02: login purpose returns identical shape for existing and non-existing emails', async () => {
      const resExisting = await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: existingUser.email, name: 'Whoever', purpose: 'login' })
        .timeout(15000);

      const resNonExisting = await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: nonExistingEmail, name: 'Whoever', purpose: 'login' })
        .timeout(15000);

      expect(resExisting.status).toBe(200);
      expect(resNonExisting.status).toBe(200);
      expect(resExisting.body.success).toBe(true);
      expect(resNonExisting.body.success).toBe(true);
      expect(Object.keys(resExisting.body.data).sort()).toEqual(Object.keys(resNonExisting.body.data).sort());

      console.log('✅ TC-OTP-02 PASSED');
    });

    it('TC-OTP-03: registration for a non-existing email actually creates an OTP record', async () => {
      const freshEmail = 'otp-fresh-registration@example.com';
      await OTP.deleteMany({ email: freshEmail });

      await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: freshEmail, name: 'Fresh', purpose: 'registration' })
        .timeout(15000);

      const record = await OTP.findOne({ email: freshEmail, purpose: 'registration' });
      expect(record).not.toBeNull();

      console.log('✅ TC-OTP-03 PASSED');
    });

    it('TC-OTP-04: registration for an already-registered email does NOT create a new OTP record', async () => {
      await OTP.deleteMany({ email: existingUser.email, purpose: 'registration' });

      await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: existingUser.email, name: 'Whoever', purpose: 'registration' })
        .timeout(15000);

      const record = await OTP.findOne({ email: existingUser.email, purpose: 'registration' });
      expect(record).toBeNull();

      console.log('✅ TC-OTP-04 PASSED');
    });
  });

  describe('B) NOSQL OPERATOR INJECTION — purpose field', () => {

    it('TC-OTP-05: {"purpose":{"$ne":"x"}} is rejected as a validation error, not a query operator', async () => {
      const response = await request(app)
        .post('/api/v1/otp/verify-otp')
        .send({ email: 'someone@example.com', otp: '123456', purpose: { $ne: 'x' } })
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');

      console.log('✅ TC-OTP-05 PASSED');
    });

    it('TC-OTP-06: an out-of-enum purpose string is rejected', async () => {
      const response = await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: 'someone@example.com', name: 'Someone', purpose: 'not-a-real-purpose' })
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      console.log('✅ TC-OTP-06 PASSED');
    });
  });
});
