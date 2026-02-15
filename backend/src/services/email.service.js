import nodemailer from 'nodemailer';
import logger from '../config/logger.js';

// ✅ Configure Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  }
});

// ✅ Verify SMTP connection on startup
transporter.verify((error, success) => {
  if (error) {
    logger.error('❌ Email service error:', error.message);
    console.error('📧 Email Config:', {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD ? '***' : 'NOT SET'
    });
  } else {
    logger.info('✅ Email service ready');
    console.log('✅ Email service connected successfully');
  }
});

export class EmailService {
  // ✅ Send OTP email
  static async sendOTPEmail(email, otp, name, purpose = 'registration') {
    try {
      const subject = '🔐 Your Pandav MSG Verification Code';
      const html = this.getOTPTemplate(otp, name, purpose);

      const result = await transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_EMAIL}>`,
        to: email,
        subject,
        html
      });

      logger.info(`✅ OTP email sent to ${email}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error(`❌ Failed to send OTP email: ${error.message}`);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  // ✅ Send welcome email
  static async sendWelcomeEmail(email, name) {
    try {
      const html = this.getWelcomeTemplate(name);

      const result = await transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_EMAIL}>`,
        to: email,
        subject: '👋 Welcome to Pandav MSG!',
        html
      });

      logger.info(`✅ Welcome email sent to ${email}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error(`❌ Failed to send welcome email: ${error.message}`);
      throw error;
    }
  }

  // ✅ OTP Email Template
  static getOTPTemplate(otp, name, purpose = 'registration') {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
          .content { padding: 40px 30px; }
          .otp-box { background: #f0f0f0; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .otp-code { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 4px; text-align: center; margin: 20px 0; font-family: monospace; }
          .footer { background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Pandav MSG</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Your verification code is:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <p>This code expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</p>
            <p style="color: #666; font-size: 14px;">Never share this code with anyone.</p>
          </div>
          <div class="footer">
            <p>© 2024 Pandav MSG. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ✅ Welcome Email Template
  static getWelcomeTemplate(name) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
          .content { padding: 40px 30px; }
          .footer { background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👋 Welcome to Pandav MSG!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Your account has been created successfully. Start chatting now!</p>
          </div>
          <div class="footer">
            <p>© 2024 Pandav MSG. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default EmailService;