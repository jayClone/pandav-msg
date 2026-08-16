import User from '../models/User.js';
import mongoose from 'mongoose';
import { getCache, setCache } from '../config/redis.js';
import { sendServerError } from '../utils/errorResponse.js';

/**
 * Get all registered users with pagination and caching
 */
export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { skip, limit, page } = req.pagination;

    const cacheKey = `users:all:page:${page}:limit:${limit}:exclude:${currentUserId}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: 'Users fetched from cache',
        ...cachedData
      });
    }

    const [users, total] = await Promise.all([
      User.find({ _id: { $ne: currentUserId } })
        .select('_id name email isOnline lastSeen createdAt')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments({ _id: { $ne: currentUserId } })
    ]);

    const formattedUsers = users.map(user => ({
      _id: user._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
      status: user.isOnline ? 'online' : 'offline'
    }));

    const responseData = {
      data: formattedUsers,
      count: formattedUsers.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };

    await setCache(cacheKey, responseData, 300);

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      ...responseData
    });

  } catch (error) {
    console.error('Get all users error:', error.message);
    return sendServerError(res, error, 'Failed to fetch users');
  }
};

/**
 * Get specific user profile
 * 
 * @route GET /api/v1/users/:userId
 * @access Private
 * @returns User data with online status
 */
export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId)
      .select('_id name email isOnline lastSeen createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const formattedUser = {
      _id: user._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
      status: user.isOnline ? 'online' : 'offline'
    };

    return res.status(200).json({
      success: true,
      message: 'User fetched successfully',
      data: formattedUser
    });

  } catch (error) {
    console.error('Get user profile error:', error.message);
    return sendServerError(res, error, 'Failed to fetch user');
  }
};

/**
 * Search users by name or email
 * 
 * @route GET /api/v1/users/search?q=searchTerm
 * @access Private
 * @returns Array of matching users
 */
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user._id;
    const { skip, limit } = req.pagination; 

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchTerm = q.trim();

    // Uses the { name: 'text', email: 'text' } index instead of an
    // unanchored $regex scan, so this stays indexed (not a COLLSCAN) as the
    // users collection grows. Trade-off: $text does word/token matching, not
    // substring/prefix matching — searching "jo" will not match "John" the
    // way the old regex did. This endpoint isn't currently called by the
    // frontend (it does its own client-side filtering instead), so this
    // changes no live behavior today; if this gets wired up as a live
    // "search as you type" box later, revisit whether $text's matching
    // semantics still fit, or whether a prefix-anchored regex / Atlas Search
    // is a better match for that UX.
    const textFilter = {
      _id: { $ne: currentUserId },
      $text: { $search: searchTerm }
    };

    const total = await User.countDocuments(textFilter);

    const users = await User.find(textFilter)
      .select('_id name email isOnline lastSeen')
      .lean()
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: users.map(user => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        status: user.isOnline ? 'online' : 'offline'
      })),
      count: users.length,
      total,            
      page: req.pagination.page,
      limit: req.pagination.limit,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('❌ Search users error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
};