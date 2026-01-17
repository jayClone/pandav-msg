import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';

const router = express.Router();

/**
 * @route /api/v1/health
 */
router.use('/health', healthRoutes);

/**
 * @route /api/v1/auth
 */
router.use('/auth', authRoutes);

export default router;