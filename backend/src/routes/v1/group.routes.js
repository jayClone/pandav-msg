import express from 'express';

import { createGroup, getMyGroups, getGroup, addMember, removeMember, getGroupMessages, leaveGroup, deleteGroup } from '@controllers/group.controller.js';
import { protect } from '@middlewares/auth.js';

const router = express.Router();

/**
 * @route POST /api/v1/groups
 * @desc Create a new group
 * @access Private
 */
router.post('/', protect, createGroup);

/**
 * @route GET /api/v1/groups
 * @desc Get all groups for logged-in user
 * @access Private
 */
router.get('/', protect, getMyGroups);

/**
 * @route GET /api/v1/groups/:groupId
 * @desc Get single group
 * @access Private
 */
router.get('/:groupId', protect, getGroup);

/**
 * @route POST /api/v1/groups/:groupId/members
 * @desc Add member to group
 * @access Private (Admin only)
 */
router.post('/:groupId/members', protect, addMember);

/**
 * @route DELETE /api/v1/groups/:groupId/members
 * @desc Remove member from group
 * @access Private (Admin only)
 */
router.delete('/:groupId/members', protect, removeMember);

/**
 * @route POST /api/v1/groups/:groupId/leave
 * @desc Leave a group (member can leave)
 * @access Private
 */
router.post('/:groupId/leave', protect, leaveGroup);

/**
 * @route GET /api/v1/groups/:groupId/messages
 * @desc Get group chat history
 * @access Private
 */
router.get('/:groupId/messages', protect, getGroupMessages);

/**
 * @route DELETE /api/v1/groups/:groupId
 * @desc Delete a group (admin only)
 * @access Private (Admin only)
 */
router.delete('/:groupId', protect, deleteGroup);  // ✅ ADD THIS ROUTE


export default router;