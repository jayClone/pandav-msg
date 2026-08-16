import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect middleware - Verify JWT token
 * Checks Authorization header for valid Bearer token
 * Rejects if:
 *   - No Authorization header
 *   - Wrong format (not "Bearer <token>")
 *   - Invalid/expired token
 *   - User not found in database
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please Login'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token must use Bearer format'
      });
    }

    const token = authHeader.substring(7);  

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is missing'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token is invalid or expired'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or expired'
      });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or expired'
      });
    }

    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please Login'
      });
    }

    req.user = {
      userId: user._id.toString(),  
      _id: user._id,               
      email: user.email,
      name: user.name
    };
    
    next();
    
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token is invalid or expired'
    });
  }
};