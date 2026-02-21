import User from '../models/User.js';
import mongoose from 'mongoose';
import { getCache, setCache } from '../config/redis.js';

/**
 * Get all registered users with pagination and caching
 */
export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { skip, limit, page } = req.pagination;

    // ✅ 1. Try Cache First
    const cacheKey = `users:all:page:${page}:limit:${limit}:exclude:${currentUserId}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: 'Users fetched from cache',
        ...cachedData
      });
    }

    // ✅ 2. Database Fetch
    const [users, total] = await Promise.all([
      User.find({ _id: { $ne: currentUserId } })
        .select('_id name email isOnline lastSeen createdAt')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments({ _id: { $ne: currentUserId } })
    ]);

    // Format response
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

    // ✅ 3. Store in Cache for 5 minutes
    await setCache(cacheKey, responseData, 300);

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      ...responseData
    });

  } catch (error) {
    console.error('Get all users error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
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

    // Validate ObjectId format
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

    // Format response
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
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
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
    const { skip, limit } = req.pagination;  // ✅ USE pagination middleware

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchTerm = q.trim();

    // ✅ COUNT TOTAL for pagination info
    const total = await User.countDocuments({
      _id: { $ne: currentUserId },
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ]
    });

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ]
    })
      .select('_id name email isOnline lastSeen')
      .lean()
      .skip(skip)        // ✅ ADD
      .limit(limit)      // ✅ ADD
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
      total,             // ✅ ADD
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