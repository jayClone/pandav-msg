import express from 'express';
import OTPController from '../../controllers/otp.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { otpArcjet } from '../../middlewares/arcjet.js'; 

const router = express.Router();

// ✅ Correct endpoints (remove the 'otp/' prefix since it's already in the route)
router.post('/send-otp', otpArcjet, asyncHandler(OTPController.sendOTP));
router.post('/verify-otp', otpArcjet, asyncHandler(OTPController.verifyOTP));
router.post('/resend-otp', otpArcjet, asyncHandler(OTPController.resendOTP));

export default router;