import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import OTP from '../models/OTP.js';
import EmailService from '../services/email.service.js';
import { deleteCache } from '../config/redis.js';
import logger from '../config/logger.js';
import { sendServerError } from '../utils/errorResponse.js';
import { invalidateFriendGraphCaches } from '../utils/friendCache.js';

const ACCESS_TOKEN_EXPIRE = process.env.JWT_ACCESS_EXPIRE || '15m';
const REFRESH_TOKEN_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';
const REFRESH_COOKIE_NAME = 'refreshToken';

const parseDurationToMs = (value) => {
  if (!value || typeof value !== 'string') {
    return 30 * 24 * 60 * 60 * 1000;
  }

  const match = value.match(/^(\d+)([smhd])$/i);

  if (!match) {
    return 30 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const unitMap = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * unitMap[unit];
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      type: 'access'
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRE }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRE }
  );
};

// The Capacitor Android app's WebView sends requests from its own local
// virtual host, "https://localhost" (or "capacitor://localhost" on older
// versions) — genuinely cross-site relative to the real backend domain.
// SameSite=Lax cookies are withheld on cross-site fetch/XHR (exactly how
// axios.js talks to /auth/refresh), so a Lax refresh cookie set for one of
// these origins is silently never sent back, forcing the app to lose its
// session every ~15 minutes (the access-token lifetime) even though the
// refresh session is still valid server-side. SameSite=None is required for
// genuinely cross-site requests to carry a cookie at all, and browsers
// reject SameSite=None without Secure outright, so secure must follow suit
// for these origins regardless of NODE_ENV.
const CROSS_SITE_COOKIE_ORIGINS = ['https://localhost', 'capacitor://localhost'];

const getCookieOptions = (req) => {
  const isCrossSiteOrigin = CROSS_SITE_COOKIE_ORIGINS.includes(req?.headers?.origin);

  return {
    httpOnly: true,
    secure: isCrossSiteOrigin || process.env.NODE_ENV === 'production',
    sameSite: isCrossSiteOrigin ? 'none' : 'lax',
    path: '/',
    maxAge: parseDurationToMs(REFRESH_TOKEN_EXPIRE)
  };
};

const clearRefreshCookie = (req, res) => {
  const isCrossSiteOrigin = CROSS_SITE_COOKIE_ORIGINS.includes(req?.headers?.origin);

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isCrossSiteOrigin || process.env.NODE_ENV === 'production',
    sameSite: isCrossSiteOrigin ? 'none' : 'lax',
    path: '/'
  });
};

const setRefreshCookie = (req, res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, getCookieOptions(req));
};

const parseCookies = (cookieHeader = '') => {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((acc, cookie) => {
      const separatorIndex = cookie.indexOf('=');

      if (separatorIndex === -1) {
        return acc;
      }

      const key = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
};

const extractRefreshToken = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[REFRESH_COOKIE_NAME];
};

const buildAuthResponse = (user, accessToken) => ({
  success: true,
  token: accessToken,
  data: {
    _id: user._id,
    name: user.name,
    email: user.email,
    publicKey: user.publicKey || null,
    avatar: user.avatar || null
  }
});

const issueSession = async (req, res, user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await User.findByIdAndUpdate(user._id, {
    refreshToken: hashToken(refreshToken),
    lastSeen: new Date()
  });

  setRefreshCookie(req, res, refreshToken);

  return accessToken;
};

const revokeStoredRefreshToken = async (userId) => {
  if (!userId) {
    return;
  }

  await User.findByIdAndUpdate(userId, { refreshToken: null }).catch((error) => {
    logger.error(`Failed to revoke refresh token: ${error.message}`);
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, otp, publicKey } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required. Please verify your email first.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

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

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'OTP expired. Please request a new OTP.'
      });
    }

    // Email format and password strength are already fully validated by
    // RegisterSchema (Joi) before this controller ever runs — re-checking
    // here with separately-written regexes only risked the two definitions
    // drifting apart. They already had: this controller's old password
    // regex additionally restricted every character to a fixed whitelist
    // that neither the frontend's checklist nor the Joi schema enforced,
    // so a password could show all-green on the signup form and still get
    // rejected here for containing e.g. an underscore.

    const userExist = await User.findOne({ email: normalizedEmail });
    if (userExist) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      publicKey: publicKey || null
    });

    // Fire-and-forget: registration latency shouldn't depend on two
    // external mail providers (Resend, then a Gmail SMTP fallback) —
    // send the welcome email in the background and just log a failure
    // instead of blocking the response on it. sendWelcomeEmail currently
    // catches its own errors and resolves with {success:false} rather than
    // rejecting, so check that; .catch() is a defensive fallback in case
    // that ever changes.
    EmailService.sendWelcomeEmail(normalizedEmail, name)
      .then((result) => {
        if (!result?.success) {
          logger.error(`Welcome email failed for ${normalizedEmail}: ${result?.error}`);
        }
      })
      .catch((err) => {
        logger.error(`Welcome email failed for ${normalizedEmail}: ${err.message}`);
      });

    await OTP.deleteOne({ _id: otpRecord._id });

    const accessToken = await issueSession(req, res, user);

    logger.info(`User registered: ${normalizedEmail}`);

    res.status(201).json({
      ...buildAuthResponse(user, accessToken),
      message: 'User registered successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    logger.error(`Registration error: ${error.message}`);
    sendServerError(res, error, 'Registration failed');
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, publicKey } = req.body;

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

    if (publicKey && publicKey !== user.publicKey) {
      user.publicKey = publicKey;
      await user.save();
      await invalidateFriendGraphCaches(user._id);
    }

    const accessToken = await issueSession(req, res, user);

    logger.info(`User logged in: ${normalizedEmail}`);

    res.status(200).json({
      ...buildAuthResponse(user, accessToken),
      message: 'Login successful'
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    sendServerError(res, error, 'Login failed');
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      otp: otp.toString(),
      purpose: 'password-reset',
      verified: true
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'OTP not verified. Please verify your email with the correct OTP.'
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'OTP expired. Please request a new OTP.'
      });
    }

    // Already validated by ResetPasswordSchema (Joi) before this
    // controller runs — see the matching comment in register() above.

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(404).json({
        success: false,
        message: 'No account found for this email'
      });
    }

    // pre('save') on the User model hashes this automatically.
    user.password = newPassword;
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    // Resetting a password is a strong "kill every existing session" signal
    // — whether the user genuinely forgot it or someone else had account
    // access, neither case should leave old sessions valid. The client
    // isn't auto-logged-in here on purpose: the E2EE keypair is derived
    // from the password (see crypto.service.js), so the frontend needs to
    // go through the normal login flow next to re-derive and re-publish the
    // correct public key for the new password — a token from this endpoint
    // would just encourage skipping that.
    await revokeStoredRefreshToken(user._id);
    clearRefreshCookie(req, res);

    logger.info(`Password reset for ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please log in with your new password.'
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`);
    sendServerError(res, error, 'Password reset failed');
  }
};

export const refreshSession = async (req, res) => {
  try {
    const refreshToken = extractRefreshToken(req);

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is missing'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );
    } catch {
      clearRefreshCookie(req, res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token is invalid or expired'
      });
    }

    if (decoded.type !== 'refresh') {
      clearRefreshCookie(req, res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token is invalid or expired'
      });
    }

    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || !user.refreshToken) {
      clearRefreshCookie(req, res);
      return res.status(401).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (user.refreshToken !== hashToken(refreshToken)) {
      await revokeStoredRefreshToken(user._id);
      clearRefreshCookie(req, res);
      return res.status(401).json({
        success: false,
        message: 'Session mismatch detected'
      });
    }

    const accessToken = await issueSession(req, res, user);

    res.status(200).json({
      ...buildAuthResponse(user, accessToken),
      message: 'Session refreshed'
    });
  } catch (error) {
    logger.error(`Refresh error: ${error.message}`);
    clearRefreshCookie(req, res);
    sendServerError(res, error, 'Session refresh failed');
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = extractRefreshToken(req);

    if (refreshToken) {
      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
        );
        await revokeStoredRefreshToken(decoded.userId);
      } catch {
        clearRefreshCookie(req, res);
      }
    }

    clearRefreshCookie(req, res);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    clearRefreshCookie(req, res);
    sendServerError(res, error, 'Logout failed');
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
        avatar: user.avatar || null,
        publicKey: user.publicKey || null,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error(`Get user error: ${error.message}`);
    sendServerError(res, error, 'Failed to fetch current user');
  }
};
