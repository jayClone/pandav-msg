import express from 'express';
import OTPController from '../../controllers/otp.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { otpArcjet, otpVerifyArcjet } from '../../middlewares/arcjet.js';
import { validate } from '../../middlewares/validate.js';
import { SendOtpSchema, VerifyOtpSchema, ResendOtpSchema } from '../../validators/otp.validator.js';

const router = express.Router();

//  Correct endpoints
router.post('/send-otp', validate(SendOtpSchema), otpArcjet, asyncHandler(OTPController.sendOTP));
router.post('/verify-otp', validate(VerifyOtpSchema), otpVerifyArcjet, asyncHandler(OTPController.verifyOTP));
router.post('/resend-otp', validate(ResendOtpSchema), otpArcjet, asyncHandler(OTPController.resendOTP));

export default router;