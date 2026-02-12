import express from 'express';
import { healthCheck } from '../../controllers/health.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = express.Router();
/**
 * @route GET /api/v1/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/', asyncHandler(healthCheck));

export default router;
