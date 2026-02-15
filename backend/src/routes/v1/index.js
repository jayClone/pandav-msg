import express from 'express';
import authRoutes from './auth.routes.js';
import otpRoutes from './otp.routes.js';  // ✅ ADD THIS
import userRoutes from './user.routes.js';
import friendRoutes from './friend.routes.js';
import messageRoutes from './message.routes.js';
import groupRoutes from './group.routes.js';
import healthRoutes from './health.routes.js'

const router = express.Router();

/**
 * Health Check Routes
 * @route /api/v1/health
 * GET  - Server status and database connection health
 */
router.use('/health', healthRoutes);

/**
 * Authentication Routes
 * @route /api/v1/auth
 * POST /register - User registration
 * POST /login - User login with JWT token
 * POST /logout - Invalidate session
 * GET  /me - Current authenticated user details
 */
router.use('/auth', authRoutes);

/**
 * User Routes
 * @route /api/v1/users
 * GET    / - Get all users
 * GET    /:userId - Get user profile
 * GET    /search - Search users
 */
router.use('/users', userRoutes);  // ✅ ADD THIS


/**
 * Message Routes
 * @route /api/v1/messages
 * POST /private - Send private message to user
 * POST /group - Send message to group
 * GET  /:userId - Fetch chat history with user
 * GET  /conversations/all - Get all conversations
 * PUT  /read/:userId - Mark messages as read
 * DELETE /:messageId - Delete message
 * 
 * @middleware Authentication required for all endpoints
 */
router.use('/messages', messageRoutes);

/**
 * Group Routes
 * @route /api/v1/groups
 * POST / - Create new group
 * GET  / - Get all groups where user is member
 * GET  /:groupId - Get single group details
 * POST /:groupId/members - Add member to group
 * DELETE /:groupId/members - Remove member from group
 * GET  /:groupId/messages - Fetch group message history
 * 
 * @middleware Authentication required for all endpoints
 * @middleware Authorization checks on member operations
 */
router.use('/groups', groupRoutes);


//frinds routes
router.use('/friends', friendRoutes);

//otp routes
router.use('/otp', otpRoutes)

export default router;