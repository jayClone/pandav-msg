import OTP from '../models/OTP.js';
import EmailService from '../services/email.service.js';
import User from '../models/User.js';
import logger from '../config/logger.js';

//  Generate random OTP
const generateOTP = () => {
  return Math.floor(Math.pow(10, 5) + Math.random() * 9 * Math.pow(10, 5))
    .toString()
    .substring(0, 6);
};

export class OTPController {
  //  SEND OTP
  static async sendOTP(req, res) {
    try {
      const { email, name, purpose = 'registration' } = req.body;

      if (!email || !name) {
        return res.status(400).json({
          success: false,
          message: 'Email and name are required'
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (purpose === 'login') {
        const userExists = await User.findOne({ email: normalizedEmail });
        if (!userExists) {
          return res.status(404).json({
            success: false,
            message: 'User with this email not found'
          });
        }
      }

      if (purpose === 'registration') {
        const userExists = await User.findOne({ email: normalizedEmail });
        if (userExists) {
          return res.status(409).json({
            success: false,
            message: 'User with this email already exists'
          });
        }
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000);

      await OTP.deleteMany({ email: normalizedEmail, purpose });

      const otpRecord = await OTP.create({
        email: normalizedEmail,
        otp,
        purpose,
        verified: false,  
        expiresAt
      });

      
      await EmailService.sendOTPEmail(normalizedEmail, otp, name, purpose);

      logger.info(`✅ OTP sent to ${normalizedEmail} for ${purpose}`);

      res.status(200).json({
        success: true,
        message: `OTP sent to ${normalizedEmail}`,
        data: {
          email: normalizedEmail,
          expiresIn: `${process.env.OTP_EXPIRY_MINUTES || 10} minutes`
        }
      });
    } catch (error) {
      logger.error(`❌ Send OTP error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send OTP'
      });
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
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify OTP'
      });
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

      await EmailService.sendOTPEmail(normalizedEmail, otp, name || 'User', purpose);

      logger.info(`✅ OTP resent to ${normalizedEmail}`);

      res.status(200).json({
        success: true,
        message: 'New OTP sent successfully'
      });
    } catch (error) {
      logger.error(`❌ Resend OTP error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to resend OTP'
      });
    }
  }
}

export default OTPController;