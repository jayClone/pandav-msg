import { describe, it, beforeAll, afterAll, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';
import User from '@models/User.js';
import OTP from '@models/OTP.js';
import { connectDB } from '@config/db.js';
import { registerTestUser, forceVerifiedOtp } from './helpers/otp.js';

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

  describe('C) WRONG-OTP ATTEMPT TRACKING — POST /api/v1/otp/verify-otp', () => {
    // Regression tests for a real bug: verifyOTP used to look up the OTP
    // record with the *guessed* otp value baked into the Mongo query
    // itself ({email, otp, purpose}). A wrong guess just made that query
    // return null, which fell into the generic "OTP not found" branch —
    // the attempts-increment/mismatch-message code further down was
    // unreachable dead code, so OTP_MAX_ATTEMPTS was never actually
    // enforced against real wrong guesses.

    it('TC-OTP-07: a wrong guess against a real record increments attempts and reports remaining tries (not "OTP not found")', async () => {
      const email = 'otp-wrong-guess@example.com';
      await forceVerifiedOtp({ email, purpose: 'registration', otp: '111111' });

      const response = await request(app)
        .post('/api/v1/otp/verify-otp')
        .send({ email, otp: '222222', purpose: 'registration' })
        .timeout(15000);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid OTP. 4 attempts remaining.');

      const record = await OTP.findOne({ email, purpose: 'registration' });
      expect(record.attempts).toBe(1);

      console.log('✅ TC-OTP-07 PASSED');
    });

    it('TC-OTP-08: the correct OTP still verifies successfully after some wrong guesses', async () => {
      const email = 'otp-eventual-success@example.com';
      await forceVerifiedOtp({ email, purpose: 'registration', otp: '333333' });

      await request(app)
        .post('/api/v1/otp/verify-otp')
        .send({ email, otp: '000000', purpose: 'registration' })
        .timeout(15000);

      const response = await request(app)
        .post('/api/v1/otp/verify-otp')
        .send({ email, otp: '333333', purpose: 'registration' })
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      console.log('✅ TC-OTP-08 PASSED');
    });

    it('TC-OTP-09: exhausting OTP_MAX_ATTEMPTS deletes the record and blocks further attempts, even with the correct code', async () => {
      const email = 'otp-max-attempts@example.com';
      await forceVerifiedOtp({ email, purpose: 'registration', otp: '444444' });

      // The attempts>=MAX check runs at the START of each call, against
      // the count from *previous* calls — so it takes maxAttempts wrong
      // guesses to raise attempts to MAX (each returning the "N remaining"
      // message, down to "0 attempts remaining" on the last one), and one
      // more call after that to actually see the "too many" rejection.
      const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS) || 5;
      let lastResponse;
      for (let i = 0; i < maxAttempts + 1; i++) {
        lastResponse = await request(app)
          .post('/api/v1/otp/verify-otp')
          .send({ email, otp: '999999', purpose: 'registration' })
          .timeout(15000);
      }

      expect(lastResponse.status).toBe(400);
      expect(lastResponse.body.message).toContain('Too many verification attempts');

      const afterExhausted = await request(app)
        .post('/api/v1/otp/verify-otp')
        .send({ email, otp: '444444', purpose: 'registration' })
        .timeout(15000);

      expect(afterExhausted.status).toBe(400);
      expect(afterExhausted.body.message).toContain('not found');

      console.log('✅ TC-OTP-09 PASSED');
    });
  });

  describe('D) ENUMERATION PREVENTION — POST /api/v1/otp/resend-otp', () => {
    // Regression tests: resendOTP had no existing-user guard at all, unlike
    // sendOTP — a resend-otp call for an already-registered email would
    // silently bypass the enumeration protection sendOTP enforces, really
    // creating and emailing a fresh OTP and confirming the account exists.

    it('TC-OTP-10: resend for an already-registered email (registration purpose) does NOT create a new OTP record', async () => {
      await OTP.deleteMany({ email: existingUser.email, purpose: 'registration' });

      const response = await request(app)
        .post('/api/v1/otp/resend-otp')
        .send({ email: existingUser.email, name: 'Whoever', purpose: 'registration' })
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const record = await OTP.findOne({ email: existingUser.email, purpose: 'registration' });
      expect(record).toBeNull();

      console.log('✅ TC-OTP-10 PASSED');
    });

    it('TC-OTP-11: resend for a non-existing email (login purpose) does NOT create a new OTP record', async () => {
      const response = await request(app)
        .post('/api/v1/otp/resend-otp')
        .send({ email: nonExistingEmail, purpose: 'login' })
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const record = await OTP.findOne({ email: nonExistingEmail, purpose: 'login' });
      expect(record).toBeNull();

      console.log('✅ TC-OTP-11 PASSED');
    });

    it('TC-OTP-12: resend for a legitimately eligible email (fresh registration) still creates a new OTP record', async () => {
      const freshEmail = 'otp-resend-fresh@example.com';
      await OTP.deleteMany({ email: freshEmail, purpose: 'registration' });

      const response = await request(app)
        .post('/api/v1/otp/resend-otp')
        .send({ email: freshEmail, name: 'Fresh', purpose: 'registration' })
        .timeout(15000);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const record = await OTP.findOne({ email: freshEmail, purpose: 'registration' });
      expect(record).not.toBeNull();

      console.log('✅ TC-OTP-12 PASSED');
    });
  });
});
