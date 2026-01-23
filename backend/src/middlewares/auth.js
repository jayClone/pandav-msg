import jwt from 'jsonwebtoken';
import User from '@models/User.js';

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
    //  Check Authorization header exists
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please Login'
      });
    }

    //  Verify "Bearer" format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token must use Bearer format'
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.substring(7);  // Remove "Bearer " prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token is missing'
      });
    }

    // Verify token signature and expiration
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

    // Verify user still exists in database
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please Login'
      });
    }

    // Attach user data with userId property (string)
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