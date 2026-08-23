import User from '../models/User.js';
import mongoose from 'mongoose';
import { getCache, setCache } from '../config/redis.js';
import { sendServerError } from '../utils/errorResponse.js';
import { invalidateFriendGraphCaches } from '../utils/friendCache.js';

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
        .select('_id name email avatar isOnline lastSeen createdAt')
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
      avatar: user.avatar || null,
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
      .select('_id name email avatar isOnline lastSeen createdAt')
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
      avatar: user.avatar || null,
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
      .select('_id name email avatar isOnline lastSeen')
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
        avatar: user.avatar || null,
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

/**
 * Set/replace the current user's avatar
 *
 * @route PUT /api/v1/users/me/avatar
 * @access Private
 * @body { avatarData: string } — a base64 image data URL (validated + size
 *   capped by UpdateAvatarSchema; the client is expected to have already
 *   compressed the image before this point)
 */
export const updateAvatar = async (req, res) => {
  try {
    const userId = req.user._id;
    const { avatarData } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarData },
      { new: true, runValidators: true }
    ).select('_id name email avatar');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Friends' cached friend-lists embed a snapshot of this user's fields
    // (see auth.Controller.js's login handler, which does the same for
    // publicKey changes) — invalidate so the new avatar shows up promptly
    // instead of waiting out the cache TTL.
    await invalidateFriendGraphCaches(userId);

    return res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      data: { avatar: user.avatar }
    });
  } catch (error) {
    console.error('❌ Update avatar error:', error.message);
    return sendServerError(res, error, 'Failed to update avatar');
  }
};

/**
 * Remove the current user's avatar (revert to the default initial-letter look)
 *
 * @route DELETE /api/v1/users/me/avatar
 * @access Private
 */
export const removeAvatar = async (req, res) => {
  try {
    const userId = req.user._id;

    await User.findByIdAndUpdate(userId, { avatar: null });
    await invalidateFriendGraphCaches(userId);

    return res.status(200).json({
      success: true,
      message: 'Avatar removed successfully'
    });
  } catch (error) {
    console.error('❌ Remove avatar error:', error.message);
    return sendServerError(res, error, 'Failed to remove avatar');
  }
};