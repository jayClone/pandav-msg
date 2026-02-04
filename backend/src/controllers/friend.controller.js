import Friend from '@models/Friend.js';
import User from '@models/User.js';
import { MESSAGES } from '@constants/response.messages.js';
import mongoose from 'mongoose';

/**
 * Send friend request
 */
export const sendFriendRequest = async (req, res) => {
  try {
    const senderId = req.user?.id || req.user?._id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID is required',
      });
    }

    // validate objectId format First
    if (!mongoose.Types.ObjectId.isValid(receiverId)){
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    // ✅ Cannot send request to yourself
    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself',
      });
    }

    // ✅ Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // ✅ Check if already friends
    const existingFriend = await Friend.findOne({
      $or: [
        { senderId, receiverId, status: 'accepted' },
        { senderId: receiverId, receiverId: senderId, status: 'accepted' },
      ],
    });

    if (existingFriend) {
      return res.status(400).json({
        success: false,
        message: 'Already friends',
      });
    }

    // ✅ Check if request already pending FROM THIS SENDER
    // (Allow reverse requests if the other direction is pending)
    const pendingRequest = await Friend.findOne({
      senderId,
      receiverId,
      status: 'pending',
    });

    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already sent',
      });
    }

    // ✅ If reverse request exists (B→A when A→B pending), delete old one first
    const reverseRequest = await Friend.findOne({
      senderId: receiverId,
      receiverId: senderId,
      status: 'pending',
    });

    if (reverseRequest) {
      // Delete old reverse request, allow new one from sender
      await Friend.findByIdAndDelete(reverseRequest._id);
    }

    // ✅ Create friend request
    const friendRequest = await Friend.create({
      senderId,
      receiverId,
      status: 'pending',
    });

    console.log(`✅ Friend request sent from ${senderId} to ${receiverId}`);

    return res.status(201).json({
      success: true,
      message: 'Friend request sent successfully',
      data: friendRequest,
    });
  } catch (error) {
    console.error('❌ Error sending friend request:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send friend request',
      error: error.message,
    });
  }
};

/**
 * Accept friend request
 */
export const acceptFriendRequest = async (req, res) => {
  try {
    const receiverId = req.user?.id || req.user?._id;
    const { requestId } = req.params;

    const friendRequest = await Friend.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found',
      });
    }

    // ✅ Check if request is for this user
    if (friendRequest.receiverId.toString() !== receiverId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this request',
      });
    }

    // ✅ Check if already accepted
    if (friendRequest.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Friend request already accepted',
      });
    }

    // ✅ Update status
    friendRequest.status = 'accepted';
    friendRequest.acceptedAt = new Date();
    await friendRequest.save();

    console.log(`✅ Friend request accepted between ${friendRequest.senderId} and ${receiverId}`);

    return res.status(200).json({
      success: true,
      message: 'Friend request accepted',
      data: friendRequest,
    });
  } catch (error) {
    console.error('❌ Error accepting friend request:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept friend request',
      error: error.message,
    });
  }
};

/**
 * Reject/Cancel friend request
 */
export const rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { requestId } = req.params;

    const friendRequest = await Friend.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found',
      });
    }

    // ✅ Check if user is involved in this request
    const isInvolved =
      friendRequest.senderId.toString() === userId.toString() ||
      friendRequest.receiverId.toString() === userId.toString();

    if (!isInvolved) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // ✅ Delete request
    await Friend.findByIdAndDelete(requestId);

    console.log(`✅ Friend request rejected/cancelled`);

    return res.status(200).json({
      success: true,
      message: 'Friend request rejected',
    });
  } catch (error) {
    console.error('❌ Error rejecting friend request:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject friend request',
      error: error.message,
    });
  }
};

/**
 * Get pending friend requests (received)
 */
export const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const requests = await Friend.find({
      receiverId: userId,
      status: 'pending',
    })
      .populate('senderId', 'name email _id')
      .populate('receiverId', 'name email _id')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Pending requests retrieved',
      data: requests,
    });
  } catch (error) {
    console.error('❌ Error fetching pending requests:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending requests',
      error: error.message,
    });
  }
};

/**
 * Get friends list
 */
export const getFriends = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const friends = await Friend.find({
      $or: [
        { senderId: userId, status: 'accepted' },
        { receiverId: userId, status: 'accepted' },
      ],
    })
      .populate('senderId', 'name email _id')
      .populate('receiverId', 'name email _id')
      .sort({ acceptedAt: -1 });

    // ✅ Flatten friends list
    const friendsList = friends.map((friend) => {
      const friendUser =
        friend.senderId._id.toString() === userId.toString()
          ? friend.receiverId
          : friend.senderId;
      return {
        _id: friendUser._id,
        name: friendUser.name,
        email: friendUser.email,
        friendshipId: friend._id,
        acceptedAt: friend.acceptedAt,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Friends list retrieved',
      data: friendsList,
    });
  } catch (error) {
    console.error('❌ Error fetching friends:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch friends',
      error: error.message,
    });
  }
};

/**
 * Check if two users are friends
 */
export const checkFriendStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { otherUserId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const friend = await Friend.findOne({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    });

    if (!friend) {
      return res.status(200).json({
        success: true,
        status: 'none',
        message: 'No friendship relationship',
      });
    }

    return res.status(200).json({
      success: true,
      status: friend.status,
      data: friend,
      message: `Friendship status: ${friend.status}`,
    });
  } catch (error) {
    console.error('❌ Error checking friend status:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to check friend status',
      error: error.message,
    });
  }
};

/**
 * Remove friend
 */
export const removeFriend = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { friendId } = req.params; 

    // ✅ Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const friend = await Friend.findOne({
      $or: [
        { senderId: userId, receiverId: friendId, status: 'accepted' },
        { senderId: friendId, receiverId: userId, status: 'accepted' },
      ],
    });

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'Friendship not found',
      });
    }

    await Friend.findByIdAndDelete(friend._id);

    console.log(`✅ Friendship removed between ${userId} and ${friendId}`);

    return res.status(200).json({
      success: true,
      message: 'Friend removed successfully',
    });
  } catch (error) {
    console.error('❌ Error removing friend:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove friend',
      error: error.message,
    });
  }
};