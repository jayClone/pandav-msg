import express from 'express';
import {
  sendPrivateMessage,
  sendGroupMessage,
  getChatHistory,
  getConversations,
  markAsRead,
  deleteMessage,
  markGroupMessagesAsRead,
  getMessageReadReceipts
} from '../../controllers/message.controller.js';
import { protect } from '../../middlewares/auth.js';
import { pagination } from '../../middlewares/pagination.js';
import { messageArcjet } from '../../middlewares/arcjet.js';
import { validate } from '../../middlewares/validate.js';
import { SendPrivateMessageSchema, SendGroupMessageSchema } from '../../validators/message.validator.js';
import { asyncHandler } from '../../utils/asyncHandler.js';


const router = express.Router();

/**
 * @route POST /api/v1/messages/private
 * @desc Send private message to a user
 * @access Private
 * @param {string} receiverId - User to receive message
 * @param {string} message - Message content
 */
router.post('/private', protect, validate(SendPrivateMessageSchema), messageArcjet, asyncHandler(sendPrivateMessage));

/**
 * @route POST /api/v1/messages/group
 * @desc Send message to a group
 * @access Private
 * @param {string} groupId - Group to receive message
 * @param {string} message - Message content
 */
router.post('/group', protect, validate(SendGroupMessageSchema), messageArcjet, asyncHandler(sendGroupMessage));

/**
 * @route GET /api/v1/messages/:userId
 * @desc Get chat history with specific user
 * @access Private
 */
router.get('/:userId', protect, pagination, asyncHandler(getChatHistory));

/**
 * @route GET /api/v1/messages/conversations/all
 * @desc Get all conversations with unread counts
 * @access Private
 */
router.get('/conversations/all', protect,pagination, asyncHandler(getConversations));

/**
 * @route PUT /api/v1/messages/read/:userId
 * @desc Mark all messages from user as read (private)
 * @access Private
 */
router.put('/read/:userId', protect, asyncHandler(markAsRead));

/**
 * @route GET /api/v1/messages/:messageId/read-receipts
 * @desc Get who has read a specific message
 * @access Private
 */
router.get('/:messageId/read-receipts', protect,pagination, getMessageReadReceipts);

/**
 * @route PUT /api/v1/messages/group/:groupId/read
 * @desc Mark all group messages as read
 * @access Private
 */
router.put('/group/:groupId/read', protect, markGroupMessagesAsRead);

/**
 * @route DELETE /api/v1/messages/:messageId
 * @desc Delete a message
 * @access Private
 */
router.delete('/:messageId', protect, asyncHandler(deleteMessage));

export default router;