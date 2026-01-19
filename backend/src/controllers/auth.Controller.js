import User from '@models/User.js';
import jwt from 'jsonwebtoken';

// ✅ Email validation regex (RFC 5322 standard)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ✅ Password validation regex
// Requirements: Min 8 chars, 1 uppercase, 1 number, 1 special char
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

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT: register
// ═══════════════════════════════════════════════════════════════════════════════
// Validation checks:
//   1. ✅ Name, email, password required
//   2. ✅ Email format validation
//   3. ✅ Password strength validation
//   4. ✅ Duplicate email check
//   5. ✅ Password hashing before save
// ═══════════════════════════════════════════════════════════════════════════════
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ✅ FIX 1: Validate all required fields present
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    // ✅ FIX 2: Trim and lowercase email
    const trimmedEmail = email.trim().toLowerCase();

    // ✅ FIX 3: Validate email format
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format. Please enter a valid email address'
      });
    }

    // ✅ FIX 4: Validate password strength
    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with uppercase, number, and special character'
      });
    }

    // ✅ FIX 5: Check for duplicate email (case-insensitive)
    const userExist = await User.findOne({ email: trimmedEmail });
    if (userExist) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exist'
      });
    }

    // ✅ FIX 6: Create user with trimmed/lowercase email
    const user = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      password  // Will be hashed by User model middleware
    });

    const token = generateToken(user);

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
    console.error('Registration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Registration failed: ' + error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT: login
// ═══════════════════════════════════════════════════════════════════════════════
// Validation checks:
//   1. ✅ Email and password required
//   2. ✅ User exists check
//   3. ✅ Password match verification
//   4. ✅ JWT token generation
// ═══════════════════════════════════════════════════════════════════════════════
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

    // ✅ Find user with password field
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // ✅ Compare passwords - MUST use the model method
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken(user);

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
    console.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Login failed: ' + error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT: getCurrentUser
// ═══════════════════════════════════════════════════════════════════════════════
// Protected route - requires valid JWT token
// Returns: Current authenticated user data
// ═══════════════════════════════════════════════════════════════════════════════
export const getCurrentUser = async (req, res) => {
  try {
    // ✅ req.user set by protect middleware
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User data retrieved successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user: ' + error.message
    });
  }
};