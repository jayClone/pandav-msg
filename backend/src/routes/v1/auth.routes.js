import express from 'express';
import { register, login, getCurrentUser } from '../../controllers/auth.Controller.js';
import { protect } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middlewares/validate.js';
import { RegisterSchema, LoginSchema } from '../../validators/auth.validator.js';

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register new user
 * @access Public
 */
router.post(
  '/register',
  validate(RegisterSchema, 'body'),  // ✅ ADD VALIDATION
  asyncHandler(register)
);

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  validate(LoginSchema, 'body'),  // ✅ ADD VALIDATION
  asyncHandler(login)
);

/**
 * @route GET /api/v1/auth/current
 * @desc Get current user
 * @access Private
 */
router.get('/current', protect, asyncHandler(getCurrentUser));

export default router;