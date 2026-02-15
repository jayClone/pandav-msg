import sgMail from '@sendgrid/mail';
import logger from '../config/logger.js';

// ✅ Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export class EmailService {
  static async sendOTPEmail(email, otp, name, purpose = 'registration') {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        logger.error('❌ SENDGRID_API_KEY not set');
        throw new Error('Email service not configured');
      }

      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@pandav-msg.com',
        subject: '🔐 Your Pandav MSG Verification Code',
        html: this.getOTPTemplate(otp, name, purpose),
        replyTo: process.env.SENDGRID_REPLY_EMAIL || 'support@pandav-msg.com'
      };

      console.log('📧 Sending OTP via SendGrid to:', email);
      const response = await sgMail.send(msg);

      logger.info(`✅ OTP email sent to ${email}`);
      return { success: true, messageId: response[0].headers['x-message-id'] };
    } catch (error) {
      logger.error(`❌ Failed to send OTP: ${error.message}`);
      return {
        success: false,
        message: `Email error: ${error.message}`
      };
    }
  }

  static async sendWelcomeEmail(email, name) {
    try {
      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@pandav-msg.com',
        subject: '👋 Welcome to Pandav MSG!',
        html: this.getWelcomeTemplate(name),
        replyTo: process.env.SENDGRID_REPLY_EMAIL
      };

      const response = await sgMail.send(msg);
      logger.info(`✅ Welcome email sent to ${email}`);
      return { success: true };
    } catch (error) {
      logger.error(`⚠️ Welcome email failed: ${error.message}`);
      return { success: false };
    }
  }

  static getOTPTemplate(otp, name, purpose = 'registration') {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px;">
          <h1 style="color: #22c55e; text-align: center;">🔐 Pandav MSG</h1>
          <p>Hi ${name},</p>
          <p>Your verification code is:</p>
          <div style="background: #f0f9ff; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0; text-align: center;">
            <h2 style="color: #22c55e; font-family: monospace; letter-spacing: 4px; margin: 0;">${otp}</h2>
          </div>
          <p><strong>⏱️ Expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes</strong></p>
          <p style="color: #d32f2f;">🔒 Never share this code with anyone.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">© 2024 Pandav MSG. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  static getWelcomeTemplate(name) {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px;">
          <h1 style="color: #22c55e; text-align: center;">👋 Welcome to Pandav MSG!</h1>
          <p>Hi ${name},</p>
          <p>Your account has been created successfully! 🎉</p>
          <p>Start connecting with your friends and enjoy secure messaging.</p>
          <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://pandav-msg-frontend.vercel.app'}/login" 
               style="display: inline-block; padding: 12px 30px; background: #22c55e; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Login to Pandav MSG
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">© 2024 Pandav MSG. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }
}

export default EmailService;