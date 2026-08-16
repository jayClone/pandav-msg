import request from 'supertest';
import OTP from '@models/OTP.js';

/**
 * Drives the real send-otp -> verify-otp flow and returns the verified OTP
 * code, so tests exercise the same path a real client would instead of
 * hand-crafting a DB record. Registration (and this helper) requires a
 * verified OTP since the OTP-gated signup flow was added — this suite
 * predates that and used to call /auth/register directly.
 *
 * Note: send-otp intentionally no-ops (no OTP record created) for
 * purpose='registration' when the email is already registered, and for
 * purpose='login' when it isn't (enumeration-prevention fix, see
 * docs/audit/05). Only call this for an email in the state the real flow
 * expects — a new email for registration, an existing one for login.
 */
export async function sendAndVerifyOtp(app, { email, name, purpose = 'registration' }) {
  await request(app)
    .post('/api/v1/otp/send-otp')
    .send({ email, name, purpose })
    .timeout(15000);

  const otpDoc = await OTP.findOne({ email: email.toLowerCase(), purpose }).sort({ createdAt: -1 });
  if (!otpDoc) {
    throw new Error(
      `No OTP record was created for ${email} (purpose=${purpose}) - is the account already registered (for 'registration') or not registered yet (for 'login')?`
    );
  }

  await request(app)
    .post('/api/v1/otp/verify-otp')
    .send({ email, otp: otpDoc.otp, purpose })
    .timeout(15000);

  return otpDoc.otp;
}

/**
 * Registers a user through the real send-otp -> verify-otp -> register
 * flow and returns the supertest response from POST /auth/register.
 */
export async function registerTestUser(app, { name, email, password }) {
  const otp = await sendAndVerifyOtp(app, { email, name, purpose: 'registration' });

  return request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password, otp })
    .timeout(15000);
}

/**
 * For tests that need a *verified* OTP for an email that's already
 * registered (e.g. testing the duplicate-registration guard itself) —
 * send-otp won't issue one through the normal flow for such an email by
 * design, so this inserts one directly, the same way a leftover
 * still-valid OTP from before the account existed could realistically
 * still be sitting in the collection.
 */
export async function forceVerifiedOtp({ email, purpose = 'registration', otp = '123456' }) {
  await OTP.deleteMany({ email: email.toLowerCase(), purpose });
  await OTP.create({
    email: email.toLowerCase(),
    otp,
    purpose,
    verified: true,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });
  return otp;
}
