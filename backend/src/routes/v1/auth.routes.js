import express from 'express';
import { register, login, logout, refreshSession, getCurrentUser } from '../../controllers/auth.Controller.js';
import { protect } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middlewares/validate.js';
import { authArcjet } from '../../middlewares/arcjet.js';
import { RegisterSchema, LoginSchema } from '../../validators/auth.validator.js';

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register new user
 * @access Public
 */
router.post(
  '/register',
  validate(RegisterSchema, 'body'), authArcjet,
  asyncHandler(register)
);

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  validate(LoginSchema, 'body'),  authArcjet,
  asyncHandler(login)
);

router.post('/refresh', asyncHandler(refreshSession));

router.post('/logout', asyncHandler(logout));

/**
 * @route GET /api/v1/auth/current
 * @desc Get current user
 * @access Private
 */
router.get('/current', protect, asyncHandler(getCurrentUser));

export default router;
