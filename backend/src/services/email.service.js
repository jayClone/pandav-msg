import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import logger from '../config/logger.js';

// ✅ RESEND CLIENT
const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ GMAIL TRANSPORTER (Backup)
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

export class EmailService {
  /**
   * Send OTP Email via Resend (Primary) or Gmail (Fallback)
   */
  static async sendOTPEmail(email, otp, name, purpose = 'registration') {
    try {
      console.log('📧 Sending OTP via Resend to:', email);

      // ✅ Try Resend first
      if (process.env.RESEND_API_KEY) {
        try {
          const response = await resend.emails.send({
            from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
            to: email,
            subject: '🔐 Your Pandav MSG Verification Code',
            html: this.getOTPTemplate(otp, name, purpose)
          });

          if (response.error) {
            throw new Error(response.error.message);
          }

          logger.info(`✅ OTP email sent via Resend to ${email}`);
          return { 
            success: true, 
            messageId: response.data.id,
            provider: 'resend'
          };
        } catch (resendError) {
          logger.warn(`⚠️ Resend failed: ${resendError.message}, falling back to Gmail`);
          // Fall through to Gmail backup
        }
      }

      // ✅ Fallback to Gmail
      console.log('📧 Falling back to Gmail...');
      const mailOptions = {
        from: `Pandav MSG <${process.env.GMAIL_USER}>`,
        to: email,
        subject: '🔐 Your Pandav MSG Verification Code',
        html: this.getOTPTemplate(otp, name, purpose)
      };

      const response = await gmailTransporter.sendMail(mailOptions);

      logger.info(`✅ OTP email sent via Gmail to ${email}`);
      return { 
        success: true, 
        messageId: response.messageId,
        provider: 'gmail'
      };
    } catch (error) {
      logger.error(`❌ Failed to send OTP: ${error.message}`);
      return {
        success: false,
        message: `Email error: ${error.message}`
      };
    }
  }

  /**
   * Send Welcome Email via Resend (Primary) or Gmail (Fallback)
   */
  static async sendWelcomeEmail(email, name) {
    try {
      console.log('👋 Sending welcome email to:', email);

      // ✅ Try Resend first
      if (process.env.RESEND_API_KEY) {
        try {
          const response = await resend.emails.send({
            from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
            to: email,
            subject: '👋 Welcome to Pandav MSG!',
            html: this.getWelcomeTemplate(name)
          });

          if (response.error) {
            throw new Error(response.error.message);
          }

          logger.info(`✅ Welcome email sent via Resend to ${email}`);
          return { success: true, provider: 'resend' };
        } catch (resendError) {
          logger.warn(`⚠️ Resend failed: ${resendError.message}, falling back to Gmail`);
          // Fall through to Gmail backup
        }
      }

      // ✅ Fallback to Gmail
      const mailOptions = {
        from: `Pandav MSG <${process.env.GMAIL_USER}>`,
        to: email,
        subject: '👋 Welcome to Pandav MSG!',
        html: this.getWelcomeTemplate(name)
      };

      const response = await gmailTransporter.sendMail(mailOptions);

      logger.info(`✅ Welcome email sent via Gmail to ${email}`);
      return { success: true, provider: 'gmail' };
    } catch (error) {
      logger.error(`⚠️ Welcome email failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * OTP Email Template
   */
  static getOTPTemplate(otp, name, purpose = 'registration') {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h1 style="color: #22c55e; text-align: center; margin-top: 0;">🔐 Pandav MSG</h1>
          
          <p style="font-size: 16px; color: #333;">Hi ${name},</p>
          
          <p style="font-size: 14px; color: #666;">Your verification code is:</p>
          
          <div style="background: #f0f9ff; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0; text-align: center; border-radius: 4px;">
            <h2 style="color: #22c55e; font-family: 'Courier New', monospace; letter-spacing: 6px; margin: 0; font-size: 32px;">${otp}</h2>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            <strong>⏱️ Valid for 10 minutes</strong>
          </p>
          
          <div style="background: #fef2f2; padding: 12px; border-radius: 4px; margin: 20px 0;">
            <p style="color: #d32f2f; margin: 0; font-size: 13px;">
              🔒 Never share this code with anyone. Pandav MSG staff will never ask for your verification code.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            © 2024 Pandav MSG. All rights reserved.<br>
            <a href="https://pandav.jaychaudhari.me" style="color: #22c55e; text-decoration: none;">Visit our website</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Welcome Email Template
   */
  static getWelcomeTemplate(name) {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h1 style="color: #22c55e; text-align: center; margin-top: 0;">👋 Welcome to Pandav MSG!</h1>
          
          <p style="font-size: 16px; color: #333;">Hi ${name},</p>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            Your account has been created successfully! 🎉<br>
            You can now start connecting with your friends and enjoy secure, real-time messaging.
          </p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 4px; margin: 20px 0; text-align: center;">
            <a href="https://pandav-msg.vercel.app/login" style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; font-weight: bold;">
              Start Messaging
            </a>
          </div>
          
          <h3 style="color: #333; margin-top: 30px;">Getting Started:</h3>
          <ul style="color: #666; font-size: 14px; line-height: 1.8;">
            <li>✅ Complete your profile</li>
            <li>✅ Find and add friends</li>
            <li>✅ Create or join group chats</li>
            <li>✅ Enjoy encrypted messaging</li>
          </ul>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            © 2024 Pandav MSG. All rights reserved.<br>
            <a href="https://pandav.jaychaudhari.me" style="color: #22c55e; text-decoration: none;">Visit our website</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }
}

export default EmailService;