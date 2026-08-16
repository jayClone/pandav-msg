import { describe, it, beforeAll, afterAll, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';
import User from '@models/User.js';
import OTP from '@models/OTP.js';
import { connectDB } from '@config/db.js';
import { registerTestUser, sendAndVerifyOtp } from './helpers/otp.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧪 FORGOT / RESET PASSWORD TESTS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Covers the new POST /auth/reset-password endpoint plus the
 * purpose='password-reset' path through the existing OTP endpoints:
 * - send-otp must not leak whether an email has an account (same
 *   enumeration-prevention pattern as login/registration, audit 05).
 * - reset-password requires a *verified* OTP for purpose='password-reset'
 *   specifically — an OTP verified for a different purpose, or unverified,
 *   must not work.
 * - the OTP is single-use (consumed on success).
 * - the new password actually takes effect (old password stops working,
 *   new one works) and any existing session is revoked.
 */
describe('🧪 FORGOT / RESET PASSWORD', () => {
  const user = {
    name: 'Reset Test User',
    email: 'reset-test-user@example.com',
    password: 'OldPassword123!'
  };
  const nonExistingEmail = 'reset-nonexisting@example.com';

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await OTP.deleteMany({});

    await registerTestUser(app, user);
  }, 20000);

  afterAll(async () => {
    await User.deleteMany({});
    await OTP.deleteMany({});
    // Deliberately not calling disconnectDB() — see docs/audit/09.
  });

  describe('A) ENUMERATION PREVENTION — send-otp for purpose=password-reset', () => {
    it('returns the same generic shape for an existing and a non-existing email', async () => {
      const resExisting = await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: user.email, purpose: 'password-reset' })
        .timeout(15000);

      const resNonExisting = await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: nonExistingEmail, purpose: 'password-reset' })
        .timeout(15000);

      expect(resExisting.status).toBe(200);
      expect(resNonExisting.status).toBe(200);
      expect(resExisting.body.success).toBe(true);
      expect(resNonExisting.body.success).toBe(true);
      expect(Object.keys(resExisting.body.data).sort()).toEqual(Object.keys(resNonExisting.body.data).sort());
    });

    it('does not create an OTP record for a non-existing email', async () => {
      await OTP.deleteMany({ email: nonExistingEmail, purpose: 'password-reset' });

      await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: nonExistingEmail, purpose: 'password-reset' })
        .timeout(15000);

      const record = await OTP.findOne({ email: nonExistingEmail, purpose: 'password-reset' });
      expect(record).toBeNull();
    });

    it('does create an OTP record for an existing email, without requiring a name', async () => {
      await OTP.deleteMany({ email: user.email, purpose: 'password-reset' });

      const res = await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: user.email, purpose: 'password-reset' }) // no `name`
        .timeout(15000);

      expect(res.status).toBe(200);

      const record = await OTP.findOne({ email: user.email, purpose: 'password-reset' });
      expect(record).not.toBeNull();
    });

    it('also accepts an explicit empty-string name (regression: Joi .optional() alone does not allow a present-but-empty value)', async () => {
      await OTP.deleteMany({ email: user.email, purpose: 'password-reset' });

      const res = await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: user.email, name: '', purpose: 'password-reset' })
        .timeout(15000);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('B) RESET REQUIRES A VERIFIED password-reset OTP', () => {
    it('rejects reset-password with no OTP record at all', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: user.email, otp: '000000', newPassword: 'NewPassword123!' })
        .timeout(15000);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects reset-password with an OTP verified for a different purpose', async () => {
      // A registration-purpose OTP verified for the same email/otp digits
      // must not be accepted for a password reset.
      const otp = await sendAndVerifyOtp(app, { email: 'reset-cross-purpose@example.com', name: 'Cross Purpose', purpose: 'registration' });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: 'reset-cross-purpose@example.com', otp, newPassword: 'NewPassword123!' })
        .timeout(15000);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects reset-password with an unverified password-reset OTP', async () => {
      await OTP.deleteMany({ email: user.email, purpose: 'password-reset' });
      await request(app)
        .post('/api/v1/otp/send-otp')
        .send({ email: user.email, purpose: 'password-reset' })
        .timeout(15000);

      const otpDoc = await OTP.findOne({ email: user.email, purpose: 'password-reset' }).sort({ createdAt: -1 });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: user.email, otp: otpDoc.otp, newPassword: 'NewPassword123!' })
        .timeout(15000);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects a weak new password even with a verified OTP', async () => {
      const otp = await sendAndVerifyOtp(app, { email: user.email, purpose: 'password-reset' });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: user.email, otp, newPassword: 'weak' })
        .timeout(15000);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Validation failed');
    });
  });

  describe('C) END-TO-END RESET', () => {
    it('resets the password, consumes the OTP, revokes the session, and the new password works for login', async () => {
      // Log in first so there's a session/refresh-cookie to prove gets revoked.
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .timeout(15000);
      expect(loginRes.status).toBe(200);
      const preResetCookie = loginRes.headers['set-cookie'];
      expect(preResetCookie).toBeDefined();

      const newPassword = 'BrandNewPassword123!';
      const otp = await sendAndVerifyOtp(app, { email: user.email, purpose: 'password-reset' });

      const resetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: user.email, otp, newPassword })
        .timeout(15000);

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // OTP is single-use — reusing it must fail.
      const reuseRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: user.email, otp, newPassword: 'AnotherPassword123!' })
        .timeout(15000);
      expect(reuseRes.status).toBe(400);

      // Old password no longer works.
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .timeout(15000);
      expect(oldLoginRes.status).toBe(401);

      // New password works.
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: newPassword })
        .timeout(15000);
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);

      // The refresh session obtained *before* the reset must be revoked.
      const refreshWithOldCookie = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', preResetCookie)
        .timeout(15000);
      expect(refreshWithOldCookie.status).toBe(401);

      user.password = newPassword; // keep fixture in sync for any later test in this file
    });
  });
});
