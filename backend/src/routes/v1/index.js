import express from 'express';
import healthRoutes from '@v1/health.routes.js';
import authRoutes from '@v1/auth.routes.js';
import messageRoutes from '@v1/message.routes.js'
import groupRoutes from '@v1/group.routes.js'

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

/**
 * @route /api/v1/groups
 */
router.use('/groups', groupRoutes)

export default router;