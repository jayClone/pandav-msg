import express from 'express';
import {
  getAllUsers,
  getUserProfile,
  searchUsers
} from '../../controllers/user.controller.js';
import { protect } from '../../middlewares/auth.js';
import { pagination } from '../../middlewares/pagination.js';  
import { asyncHandler } from '../../utils/asyncHandler.js';


const router = express.Router();

/**
 * @route GET /api/v1/users
 * @desc Get all registered users
 * @access Private
 * Returns: Array of users with online status
 */
router.get('/', protect,pagination, asyncHandler(getAllUsers));

/**
 * @route GET /api/v1/users/search
 * @desc Search users by name or email
 * @access Private
 * Query: q=searchTerm
 */
router.get('/search', protect, pagination, asyncHandler(searchUsers));

/**
 * @route GET /api/v1/users/:userId
 * @desc Get specific user profile
 * @access Private
 */
router.get('/:userId', protect, asyncHandler(getUserProfile));

export default router;