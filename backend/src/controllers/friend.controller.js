import Friend from '../models/Friend.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { getCache, setCache, deleteCache, deleteCacheByPattern } from '../config/redis.js';
import { sendServerError } from '../utils/errorResponse.js';
import { emitToUser } from '../utils/socketEmit.js';
import { SOCKET_EVENTS } from '../constant/response.messages.js';

// getFriendshipSummary is a fixed "give me an overview" dashboard call, not
// a paginated list endpoint, so each of its lists is capped at a flat limit
// rather than wired up to page/limit query params.
const SUMMARY_LIST_LIMIT = 100;

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

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself',
      });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

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

    const reverseRequest = await Friend.findOne({
      senderId: receiverId,
      receiverId: senderId,
      status: 'pending',
    });

    if (reverseRequest) {
      await Friend.findByIdAndDelete(reverseRequest._id);
    }

    const friendRequest = await Friend.create({
      senderId,
      receiverId,
      status: 'pending',
    });

    emitToUser(req, receiverId, SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED, {
      requestId: friendRequest._id,
      senderId: req.user.userId,
      senderName: req.user.name,
      senderEmail: req.user.email,
    });

    return res.status(201).json({
      success: true,
      message: 'Friend request sent successfully',
      data: friendRequest,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Friend request already exists',
      });
    }
    console.error('❌ Error sending friend request:', error.message);
    return sendServerError(res, error, 'Failed to send friend request');
  }
};

/**
 * Accept friend request
 */
export const acceptFriendRequest = async (req, res) => {
  try {
    const receiverId = req.user?.id || req.user?._id;
    const { requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID format',
      });
    }

    const friendRequest = await Friend.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found',
      });
    }

    if (friendRequest.receiverId.toString() !== receiverId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this request',
      });
    }

    if (friendRequest.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Friend request already accepted',
      });
    }

    friendRequest.status = 'accepted';
    friendRequest.acceptedAt = new Date();
    await friendRequest.save();

    await Promise.all([
      deleteCache(`friends:v2:${friendRequest.senderId}`),
      deleteCache(`friends:v2:${receiverId}`),
      deleteCache(`friendship:summary:v2:${friendRequest.senderId}`),
      deleteCache(`friendship:summary:v2:${receiverId}`),
      deleteCacheByPattern(`requests:pending:${receiverId}:page:*`),
      deleteCacheByPattern(`requests:sent:${friendRequest.senderId}:page:*`),
    ]);

    // Notify the original sender that their request was accepted — they're
    // friends now, live, not just whenever they next reopen the modal.
    emitToUser(req, friendRequest.senderId, SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED, {
      requestId: friendRequest._id,
      friendId: req.user.userId,
      friendName: req.user.name,
      friendEmail: req.user.email,
    });

    return res.status(200).json({
      success: true,
      message: 'Friend request accepted',
      data: friendRequest,
    });
  } catch (error) {
    console.error('❌ Error accepting friend request:', error.message);
    return sendServerError(res, error, 'Failed to accept friend request');
  }
};

/**
 * Reject/Cancel friend request
 */
export const rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID format',
      });
    }

    const friendRequest = await Friend.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found',
      });
    }

    const isInvolved =
      friendRequest.senderId.toString() === userId.toString() ||
      friendRequest.receiverId.toString() === userId.toString();

    if (!isInvolved) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await Friend.findByIdAndDelete(requestId);

    await Promise.all([
      deleteCache(`friends:v2:${friendRequest.senderId}`),
      deleteCache(`friends:v2:${friendRequest.receiverId}`),
      deleteCache(`friendship:summary:v2:${friendRequest.senderId}`),
      deleteCache(`friendship:summary:v2:${friendRequest.receiverId}`),
      deleteCacheByPattern(`requests:pending:${friendRequest.receiverId}:page:*`),
      deleteCacheByPattern(`requests:sent:${friendRequest.senderId}:page:*`),
    ]);

    // This endpoint covers both "receiver declines" and "sender cancels
    // their own pending request" — notify whichever side didn't act.
    const otherPartyId =
      friendRequest.senderId.toString() === userId.toString()
        ? friendRequest.receiverId
        : friendRequest.senderId;

    emitToUser(req, otherPartyId, SOCKET_EVENTS.FRIEND_REQUEST_REJECTED, {
      requestId: friendRequest._id,
      byUserId: req.user.userId,
      byName: req.user.name,
    });

    return res.status(200).json({
      success: true,
      message: 'Friend request rejected',
    });
  } catch (error) {
    console.error('❌ Error rejecting friend request:', error.message);
    return sendServerError(res, error, 'Failed to reject friend request');
  }
};

/**
 * Get sent friend requests (by current user)
 */
export const getSentRequests = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { skip, limit, page } = req.pagination || { skip: 0, limit: 50, page: 1 };

    const cacheKey = `requests:sent:${userId}:page:${page}:limit:${limit}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: 'Sent requests retrieved from cache',
        ...cachedData
      });
    }

    const [requests, total] = await Promise.all([
      Friend.find({
        senderId: userId,
        status: 'pending',
      })
        .populate('senderId', 'name email publicKey avatar isOnline lastSeen _id')
        .populate('receiverId', 'name email publicKey avatar isOnline lastSeen _id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Friend.countDocuments({ senderId: userId, status: 'pending' })
    ]);

    const responseData = {
      data: requests,
      count: requests.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };

    await setCache(cacheKey, responseData, 30);

    return res.status(200).json({
      success: true,
      message: 'Sent requests retrieved',
      ...responseData
    });
  } catch (error) {
    console.error('❌ Error fetching sent requests:', error.message);
    return sendServerError(res, error, 'Failed to fetch sent requests');
  }
};

/**
 * Get pending friend requests (received)
 */
export const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { skip, limit, page } = req.pagination || { skip: 0, limit: 50, page: 1 };

    const cacheKey = `requests:pending:${userId}:page:${page}:limit:${limit}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: 'Pending requests retrieved from cache',
        ...cachedData
      });
    }

    const [requests, total] = await Promise.all([
      Friend.find({
        receiverId: userId,
        status: 'pending',
      })
        .populate('senderId', 'name email avatar _id')
        .populate('receiverId', 'name email avatar _id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Friend.countDocuments({ receiverId: userId, status: 'pending' })
    ]);

    const responseData = {
      data: requests,
      count: requests.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };

    await setCache(cacheKey, responseData, 30);

    return res.status(200).json({
      success: true,
      message: 'Pending requests retrieved',
      ...responseData
    });
  } catch (error) {
    console.error('❌ Error fetching pending requests:', error.message);
    return sendServerError(res, error, 'Failed to fetch pending requests');
  }
};

export const getFriends = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const cacheKey = `friends:v2:${userId}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: 'Friends list retrieved from cache',
        ...cachedData
      });
    }

    const { skip, limit, page } = req.pagination || { skip: 0, limit: 50, page: 1 };

    const [friends, total] = await Promise.all([
      Friend.find({
        $or: [
          { senderId: userId, status: 'accepted' },
          { receiverId: userId, status: 'accepted' },
        ],
      })
        .populate('senderId', 'name email publicKey avatar isOnline lastSeen _id')
        .populate('receiverId', 'name email publicKey avatar isOnline lastSeen _id')
        .sort({ acceptedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Friend.countDocuments({
        $or: [
          { senderId: userId, status: 'accepted' },
          { receiverId: userId, status: 'accepted' },
        ],
      })
    ]);

    const friendsList = friends.map((friend) => {
      const friendUser =
        friend.senderId._id.toString() === userId.toString()
          ? friend.receiverId
          : friend.senderId;
      return {
        _id: friendUser._id,
        name: friendUser.name,
        email: friendUser.email,
        publicKey: friendUser.publicKey || null,
        avatar: friendUser.avatar || null,
        isOnline: !!friendUser.isOnline,
        lastSeen: friendUser.lastSeen || null,
        friendshipId: friend._id,
        acceptedAt: friend.acceptedAt,
      };
    });

    const responseData = {
      data: friendsList,
      count: friendsList.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };

    await setCache(cacheKey, responseData, 3600);

    return res.status(200).json({
      success: true,
      message: 'Friends list retrieved',
      ...responseData
    });
  } catch (error) {
    console.error('❌ Error fetching friends:', error.message);
    return sendServerError(res, error, 'Failed to fetch friends');
  }
};

/**
 * Check if two users are friends
 */
export const checkFriendStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { otherUserId } = req.params;

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
    return sendServerError(res, error, 'Failed to check friend status');
  }
};

/**
 * Remove friend
 */
export const removeFriend = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { friendId } = req.params;

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

    await Promise.all([
      deleteCache(`friends:v2:${userId}`),
      deleteCache(`friends:v2:${friendId}`),
      deleteCache(`friendship:summary:v2:${userId}`),
      deleteCache(`friendship:summary:v2:${friendId}`)
    ]);

    emitToUser(req, friendId, SOCKET_EVENTS.FRIEND_REMOVED, {
      byUserId: req.user.userId,
      byName: req.user.name,
    });

    return res.status(200).json({
      success: true,
      message: 'Friend removed successfully',
    });
  } catch (error) {
    console.error('❌ Error removing friend:', error.message);
    return sendServerError(res, error, 'Failed to remove friend');
  }
};

/**
 * ✅ AGGREGATED SUMMARY: Fetch all contact/friend data in ONE call
 */
export const getFriendshipSummary = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    const cacheKey = `friendship:summary:v2:${userId}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: 'Friendship summary fetched from cache',
        data: cachedData
      });
    }

    const [allUsers, friends, pending, sent] = await Promise.all([
      User.find({ _id: { $ne: userId } })
        .select('_id name email publicKey avatar isOnline lastSeen')
        .sort({ name: 1 })
        .limit(50)
        .lean(),

      Friend.find({
        $or: [
          { senderId: userId, status: 'accepted' },
          { receiverId: userId, status: 'accepted' },
        ],
      })
        .populate('senderId', 'name email publicKey avatar _id')
        .populate('receiverId', 'name email publicKey avatar _id')
        .sort({ acceptedAt: -1 })
        .limit(SUMMARY_LIST_LIMIT)
        .lean(),

      Friend.find({
        receiverId: userId,
        status: 'pending',
      })
        .populate('senderId', 'name email publicKey avatar _id')
        .populate('receiverId', 'name email publicKey avatar _id')
        .sort({ createdAt: -1 })
        .limit(SUMMARY_LIST_LIMIT)
        .lean(),

      Friend.find({
        senderId: userId,
        status: 'pending',
      })
        .populate('senderId', 'name email publicKey avatar _id')
        .populate('receiverId', 'name email publicKey avatar _id')
        .sort({ createdAt: -1 })
        .limit(SUMMARY_LIST_LIMIT)
        .lean()
    ]);

    const friendsList = friends.map((f) => {
      const friendUser = f.senderId._id.toString() === userId.toString() ? f.receiverId : f.senderId;
      return { _id: friendUser._id, name: friendUser.name, email: friendUser.email, publicKey: friendUser.publicKey || null, avatar: friendUser.avatar || null };
    });

    const summaryData = {
      users: allUsers,
      friends: friendsList,
      pending: pending,
      sent: sent
    };

    await setCache(cacheKey, summaryData, 30);

    return res.status(200).json({
      success: true,
      message: 'Friendship summary retrieved successfully',
      data: summaryData
    });

  } catch (error) {
    console.error('❌ Friendship summary error:', error.message);
    return sendServerError(res, error, 'Failed to fetch friendship summary');
  }
};
