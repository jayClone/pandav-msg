import express from 'express';
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getSentRequests,
  getPendingRequests,
  getFriends,
  checkFriendStatus,
  removeFriend,
} from '../../controllers/friend.controller.js';
import { protect } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { pagination } from '../../middlewares/pagination.js'; 

const router = express.Router();

// ✅ Apply auth middleware to all routes
router.use(protect);

// ✅ Send friend request
router.post('/', asyncHandler(sendFriendRequest));

// ✅ Accept friend request
router.patch('/:requestId/accept', asyncHandler(acceptFriendRequest));

// ✅ Reject/Cancel friend request
router.delete('/:requestId', asyncHandler(rejectFriendRequest));

// get sent request
router.get('/sent', pagination, asyncHandler(getSentRequests));

// ✅ Get pending requests
router.get('/pending',pagination, asyncHandler(getPendingRequests));

// ✅ Get friends list
router.get('/', pagination, asyncHandler(getFriends));

// ✅ Check friendship status
router.get('/check/:otherUserId', asyncHandler(checkFriendStatus));

// ✅ Remove friend
router.delete('/:friendId/remove', asyncHandler(removeFriend));

export default router;