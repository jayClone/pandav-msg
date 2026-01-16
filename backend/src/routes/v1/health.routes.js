import express from 'express';
import { healthCheck } from '../../controllers/health.controller.js';

const router = express.Router();
/**
 * @route GET /api/v1/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/', healthCheck);

export default router;
