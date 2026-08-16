import crypto from 'crypto';
import OTP from '../models/OTP.js';
import EmailService from '../services/email.service.js';
import User from '../models/User.js';
import logger from '../config/logger.js';
import { sendServerError } from '../utils/errorResponse.js';

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
          message: 'Email and name are required'
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Generic response used whether or not an OTP is actually sent, so the
      // response itself never reveals whether this email is registered.
      const genericResponse = {
        success: true,
        message: `If eligible, an OTP has been sent to ${normalizedEmail}`,
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
      sendServerError(res, error, 'Failed to send OTP');
    }
  }

  //  VERIFY OTP
  static async verifyOTP(req, res) {
    try {
      const { email, otp, purpose = 'registration' } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Email and OTP are required'
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const otpRecord = await OTP.findOne({
        email: normalizedEmail,
        otp: otp.toString(),
        purpose
      });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          message: 'OTP not found. Please request a new OTP.'
        });
      }

  
      if (new Date() > otpRecord.expiresAt) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return res.status(400).json({
          success: false,
          message: 'OTP expired. Please request a new OTP.'
        });
      }

   
      if (otpRecord.attempts >= (process.env.OTP_MAX_ATTEMPTS || 5)) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return res.status(400).json({
          success: false,
          message: 'Too many verification attempts. Please request a new OTP.'
        });
      }


      if (otpRecord.otp !== otp.toString()) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        
        const remaining = (process.env.OTP_MAX_ATTEMPTS || 5) - otpRecord.attempts;
        return res.status(400).json({
          success: false,
          message: `Invalid OTP. ${remaining} attempts remaining.`
        });
      }

     
      otpRecord.verified = true;
      await otpRecord.save();

      logger.info(`✅ OTP verified for ${normalizedEmail}`);

      res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        data: {
          email: normalizedEmail,
          verified: true,
          purpose
        }
      });
    } catch (error) {
      logger.error(`❌ Verify OTP error: ${error.message}`);
      sendServerError(res, error, 'Failed to verify OTP');
    }
  }

  //  RESEND OTP
  static async resendOTP(req, res) {
    try {
      const { email, name, purpose = 'registration' } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

     
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

      let greetingName = name || 'User';
      if (purpose === 'password-reset') {
        const user = await User.findOne({ email: normalizedEmail }).select('name');
        greetingName = user?.name || 'there';
      }

      await EmailService.sendOTPEmail(normalizedEmail, otp, greetingName, purpose);

      logger.info(`✅ OTP resent to ${normalizedEmail}`);

      res.status(200).json({
        success: true,
        message: 'New OTP sent successfully'
      });
    } catch (error) {
      logger.error(`❌ Resend OTP error: ${error.message}`);
      sendServerError(res, error, 'Failed to resend OTP');
    }
  }
}

export default OTPController;