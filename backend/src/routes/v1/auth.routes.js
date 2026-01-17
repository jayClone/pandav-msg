import express from 'express';
import { register, login, getCurrentUser } from '../../controllers/authController.js';
import { protect } from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register new user
 * @access Public
 */
router.post('/register', register);

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', login);

/**
 * @route GET /api/v1/auth/current
 * @desc Get current user
 * @access Private
 */
router.get('/current', protect, getCurrentUser);

export default router;