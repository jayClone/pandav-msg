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
} from '@controllers/friend.controller.js';
import { protect } from '@middlewares/auth.js';

const router = express.Router();

// ✅ Apply auth middleware to all routes
router.use(protect);

// ✅ Send friend request
router.post('/', sendFriendRequest);

// ✅ Accept friend request
router.patch('/:requestId/accept', acceptFriendRequest);

// ✅ Reject/Cancel friend request
router.delete('/:requestId', rejectFriendRequest);

// get sent request
router.get('/sent', getSentRequests);

// ✅ Get pending requests
router.get('/pending', getPendingRequests);

// ✅ Get friends list
router.get('/', getFriends);

// ✅ Check friendship status
router.get('/check/:otherUserId', checkFriendStatus);

// ✅ Remove friend
router.delete('/:friendId/remove', removeFriend);

export default router;