import express from 'express';
import OTPController from '../../controllers/otp.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = express.Router();

/**
 * @route POST /api/v1/otp/send-otp
 * @desc Send OTP to email
 * @access Public
 */
router.post('/send-otp', asyncHandler(OTPController.sendOTP));

/**
 * @route POST /api/v1/otp/verify-otp
 * @desc Verify OTP
 * @access Public
 */
router.post('/verify-otp', asyncHandler(OTPController.verifyOTP));

/**
 * @route POST /api/v1/otp/resend-otp
 * @desc Resend OTP
 * @access Public
 */
router.post('/resend-otp', asyncHandler(OTPController.resendOTP));

export default router;