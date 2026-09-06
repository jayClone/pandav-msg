import express from 'express';
import { register, login, logout, refreshSession, getCurrentUser, resetPassword } from '../../controllers/auth.Controller.js';
import { protect } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middlewares/validate.js';
import { authArcjet, sessionArcjet } from '../../middlewares/arcjet.js';
import { RegisterSchema, LoginSchema, ResetPasswordSchema } from '../../validators/auth.validator.js';

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

/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset password using a verified password-reset OTP
 * @access Public
 */
router.post(
  '/reset-password',
  validate(ResetPasswordSchema, 'body'), authArcjet,
  asyncHandler(resetPassword)
);

router.post('/refresh', sessionArcjet, asyncHandler(refreshSession));

router.post('/logout', sessionArcjet, asyncHandler(logout));

/**
 * @route GET /api/v1/auth/current
 * @desc Get current user
 * @access Private
 */
router.get('/current', protect, asyncHandler(getCurrentUser));

export default router;
