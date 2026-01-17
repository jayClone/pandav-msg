import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import messageRoutes from './message.routes.js'

const router = express.Router();

/**
 * @route /api/v1/health
 */
router.use('/health', healthRoutes);

/**
 * @route /api/v1/auth
 */
router.use('/auth', authRoutes);

/**
 * @route /api/v1/messages
 */
router.use('/messages', messageRoutes);

export default router;