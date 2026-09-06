import crypto from 'crypto';
import OTP from '../models/OTP.js';
import EmailService from '../services/email.service.js';
import User from '../models/User.js';
import logger from '../config/logger.js';
import { sendServerError } from '../utils/errorResponse.js';
import { MESSAGES } from '../constant/response.messages.js';

//  Generate random 6-digit OTP using a CSPRNG (not Math.random())
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export class OTPController {
  //  SEND OTP
  static async sendOTP(req, res) {
    try {
      const { email, name, purpose = 'registration' } = req.body;

      // `name` is optional for password-reset (see otp.validator.js) — the
      // Joi schema already enforces this correctly; this check just needs
      // to not re-impose the stricter rule on top of it.
      if (!email || (!name && purpose !== 'password-reset')) {
        return res.status(400).json({
          success: false,
          message: MESSAGES.OTP.NAME_REQUIRED
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Generic response used whether or not an OTP is actually sent, so the
      // response itself never reveals whether this email is registered.
      const genericResponse = {
        success: true,
        message: MESSAGES.OTP.GENERIC_SENT(normalizedEmail),
        data: {
          email: normalizedEmail,
          expiresIn: `${process.env.OTP_EXPIRY_MINUTES || 10} minutes`
        }
      };

      const userExists = await User.findOne({ email: normalizedEmail });

      if (purpose === 'login' && !userExists) {
        return res.status(200).json(genericResponse);
      }

      if (purpose === 'registration' && userExists) {
        return res.status(200).json(genericResponse);
      }

      // Same enumeration-prevention pattern as login: never send (or reveal
      // via timing/response-shape) whether an email has an account when
      // someone claims to have forgotten its password.
      if (purpose === 'password-reset' && !userExists) {
        return res.status(200).json(genericResponse);
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000);

      await OTP.deleteMany({ email: normalizedEmail, purpose });

      await OTP.create({
        email: normalizedEmail,
        otp,
        purpose,
        verified: false,
        expiresAt
      });

      // A forgot-password form only collects an email, not a name — use the
      // account's real name for the email greeting instead of trusting
      // (optional, usually absent) client input for this purpose.
      const greetingName = purpose === 'password-reset' ? (userExists?.name || 'there') : name;

      await EmailService.sendOTPEmail(normalizedEmail, otp, greetingName, purpose);

      logger.info(`✅ OTP sent to ${normalizedEmail} for ${purpose}`);

      res.status(200).json(genericResponse);
    } catch (error) {
      logger.error(`❌ Send OTP error: ${error.message}`);
      sendServerError(res, error, MESSAGES.OTP.SEND_FAILED);
    }
  }

  //  VERIFY OTP
  static async verifyOTP(req, res) {
    try {
      const { email, otp, purpose = 'registration' } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: MESSAGES.OTP.EMAIL_AND_OTP_REQUIRED
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Look up by {email, purpose} only — NOT also by the submitted otp
      // value. sendOTP/resendOTP always delete any prior record for this
      // {email, purpose} before creating a new one, so there's at most one
      // record to find. Filtering the query on the guessed otp value too
      // meant a WRONG guess made findOne return null, which fell straight
      // into the generic "not found" branch below and skipped the
      // attempts-increment/mismatch-message logic entirely — that code was
      // unreachable dead code, since by the time a query match included the
      // right otp, verification had already succeeded. This is what let
      // OTP_MAX_ATTEMPTS go unenforced against real wrong guesses.
      const otpRecord = await OTP.findOne({
        email: normalizedEmail,
        purpose
      });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: MESSAGES.OTP.NOT_FOUND
        });
      }


      if (new Date() > otpRecord.expiresAt) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return res.status(400).json({
          success: false,
          message: MESSAGES.OTP.EXPIRED
        });
      }


      if (otpRecord.attempts >= (process.env.OTP_MAX_ATTEMPTS || 5)) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return res.status(400).json({
          success: false,
          message: MESSAGES.OTP.TOO_MANY_ATTEMPTS
        });
      }


      if (otpRecord.otp !== otp.toString()) {
        otpRecord.attempts += 1;
        await otpRecord.save();

        const remaining = (process.env.OTP_MAX_ATTEMPTS || 5) - otpRecord.attempts;
        return res.status(400).json({
          success: false,
          message: MESSAGES.OTP.INVALID(remaining)
        });
      }


      otpRecord.verified = true;
      await otpRecord.save();

      logger.info(`✅ OTP verified for ${normalizedEmail}`);

      res.status(200).json({
        success: true,
        message: MESSAGES.OTP.VERIFIED,
        data: {
          email: normalizedEmail,
          verified: true,
          purpose
        }
      });
    } catch (error) {
      logger.error(`❌ Verify OTP error: ${error.message}`);
      sendServerError(res, error, MESSAGES.OTP.VERIFY_FAILED);
    }
  }

  //  RESEND OTP
  static async resendOTP(req, res) {
    try {
      const { email, name, purpose = 'registration' } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: MESSAGES.OTP.EMAIL_REQUIRED
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Same enumeration-prevention guard as sendOTP — without this, a
      // resend-otp call bypassed it entirely: a registration OTP could be
      // sent (and really emailed) to an address that already has an
      // account, silently confirming the account exists.
      const genericResponse = {
        success: true,
        message: MESSAGES.OTP.RESEND_SUCCESS
      };

      const userExists = await User.findOne({ email: normalizedEmail });

      if (purpose === 'login' && !userExists) {
        return res.status(200).json(genericResponse);
      }

      if (purpose === 'registration' && userExists) {
        return res.status(200).json(genericResponse);
      }

      if (purpose === 'password-reset' && !userExists) {
        return res.status(200).json(genericResponse);
      }

      await OTP.deleteMany({ email: normalizedEmail, purpose });

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000);

      await OTP.create({
        email: normalizedEmail,
        otp,
        purpose,
        verified: false,
        expiresAt
      });

      const greetingName = purpose === 'password-reset' ? (userExists?.name || 'there') : (name || 'User');

      await EmailService.sendOTPEmail(normalizedEmail, otp, greetingName, purpose);

      logger.info(`✅ OTP resent to ${normalizedEmail}`);

      res.status(200).json({
        success: true,
        message: MESSAGES.OTP.RESEND_SUCCESS
      });
    } catch (error) {
      logger.error(`❌ Resend OTP error: ${error.message}`);
      sendServerError(res, error, MESSAGES.OTP.RESEND_FAILED);
    }
  }
}

export default OTPController;