import User from '../models/User.js';
import mongoose from 'mongoose';

/**
 * Get all registered users
 * 
 * @route GET /api/v1/users
 * @access Private
 * @returns Array of all users with online status
 */
export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get all users except current user
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select('_id name email isOnline lastSeen createdAt')
      .sort({ name: 1 })
      .lean();

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

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: formattedUsers,
      count: formattedUsers.length
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

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Search by name or email (case-insensitive)
    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    })
      .select('_id name email isOnline lastSeen createdAt')
      .sort({ name: 1 })
      .limit(20)
      .lean();

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

    return res.status(200).json({
      success: true,
      message: 'Search results',
      data: formattedUsers,
      count: formattedUsers.length
    });

  } catch (error) {
    console.error('Search users error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
};