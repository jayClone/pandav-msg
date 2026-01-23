import express from 'express';
import {sendPrivateMessage, getChatHistory, getConversations,markAsRead,deleteMessage } from '@controllers/message.controller.js';
import { protect } from '@middlewares/auth.js';

const router = express.Router();

// ✅ ADD: Private message endpoint
router.post('/private', protect, sendPrivateMessage);

/**
 * @route GET /api/v1/messages/:userId
 * @desc Get chat history with specific user
 * @access Private
 * @param userId - ID of other user
 * @returns Array of messages
 */
router.get('/:userId', protect, getChatHistory);

/**
 * @route GET /api/v1/messages/conversations/all
 * @desc Get all conversations with unread counts
 * @access Private
 * @returns Array of conversations
 */
router.get('/conversations/all', protect, getConversations);

/**
 * @route PUT /api/v1/messages/read/:userId
 * @desc Mark all messages from user as read
 * @access Private
 */
router.put('/read/:userId', protect, markAsRead);

/**
 * @route DELETE /api/v1/messages/:messageId
 * @desc Delete a message
 * @access Private
 */
router.delete('/:messageId', protect, deleteMessage);

export default router;