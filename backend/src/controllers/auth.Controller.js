import User from '../models/User.js';
import OTP from '../models/OTP.js';
import EmailService from '../services/email.service.js';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/;

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// ✅ REGISTER WITH OTP VERIFICATION
export const register = async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    if (!otp) {
      console.error('❌ OTP IS MISSING!');
      return res.status(400).json({
        success: false,
        message: 'OTP is required. Please verify your email first.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find OTP in database
    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      otp: otp.toString(),
      purpose: 'registration',
      verified: true
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'OTP not verified. Please verify your email with correct OTP.'
      });
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'OTP expired. Please request a new OTP.'
      });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with uppercase, number, and special character'
      });
    }

    // Check for duplicate email
    const userExist = await User.findOne({ email: normalizedEmail });
    if (userExist) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password
    });

    // Send welcome email
    await EmailService.sendWelcomeEmail(normalizedEmail, name);

    // ✅ NOW DELETE OTP after successful registration
    await OTP.deleteOne({ _id: otpRecord._id });

    const token = generateToken(user);

    logger.info(`✅ User registered: ${normalizedEmail}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    logger.error(`❌ Registration error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ✅ LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // ✅ BACKGROUND UPDATE: lastSeen (don't block the response)
    User.findByIdAndUpdate(user._id, { lastSeen: new Date() }).catch(err =>
      logger.error(`❌ Background lastSeen update error: ${err.message}`)
    );


    const token = generateToken(user);

    logger.info(`✅ User logged in: ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    logger.error(`❌ Login error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error(`❌ Get user error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};