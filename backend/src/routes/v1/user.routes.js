import express from 'express';
import {
  getAllUsers,
  getUserProfile,
  searchUsers
} from '@controllers/user.controller.js';
import { protect } from '@middlewares/auth.js';

const router = express.Router();

/**
 * @route GET /api/v1/users
 * @desc Get all registered users
 * @access Private
 * Returns: Array of users with online status
 */
router.get('/', protect, getAllUsers);

/**
 * @route GET /api/v1/users/search
 * @desc Search users by name or email
 * @access Private
 * Query: q=searchTerm
 */
router.get('/search', protect, searchUsers);

/**
 * @route GET /api/v1/users/:userId
 * @desc Get specific user profile
 * @access Private
 */
router.get('/:userId', protect, getUserProfile);

export default router;