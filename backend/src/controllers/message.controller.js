import mongoose from 'mongoose';
import Message from '../models/Message.js'
import User from '../models/User.js';
import Group from '../models/Group.js';
import { getCache, setCache } from '../config/redis.js';


/**
 * Validate MongoDB ObjectId format
 * @param {string|ObjectId} id - ID to validate
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Convert string to MongoDB ObjectId
 * @param {string|ObjectId} id - ID to convert
 * @returns {ObjectId|null}
 */
const toObjectId = (id) => {
  if (!id) return null;
  if (typeof id === 'object') return id;
  return mongoose.Types.ObjectId.createFromHexString(id);
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET CHAT HISTORY (Private Messages)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get chat history between two users
 * 
 * @route GET /api/v1/messages/:userId
 * @param req.user.userId - Current user ID
 * @param req.params.userId - Other user ID
 * @returns Array of messages (last 150)
 */
export const getChatHistory = async (req, res) => {
  try {
    const myId = req.user?.userId || req.user?._id;
    const otherUserId = req.params.userId;
    const { before, limit = 50 } = req.query;
    const pageSize = parseInt(limit);

    if (!myId) {
      return res.status(401).json({
        success: false,
        message: "User is not Authenticated"
      });
    }

    if (!isValidObjectId(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const query = {
      $or: [
        { senderId: myId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: myId }
      ],
      deleted: { $ne: true }
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'name email')
      .sort({ createdAt: -1 })
      .limit(pageSize + 1)
      .lean();

    const hasMore = messages.length > pageSize;
    const results = hasMore ? messages.slice(0, pageSize) : messages;

    results.reverse();

    Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: myId,
        read: false,
      },
      { read: true }
    ).catch(err => console.error('background markAsRead error:', err.message));

    const formattedMessages = results.map(msg => ({
      _id: msg._id,
      fromUserId: msg.senderId._id,
      senderName: msg.senderId.name,
      senderEmail: msg.senderId.email,
      toUserId: msg.receiverId,
      message: msg.message,
      time: msg.createdAt,
      read: msg.read,
      chatType: msg.chatType,
      createdAt: msg.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: formattedMessages,
      count: formattedMessages.length,
      hasMore,
      nextCursor: hasMore ? results[0].createdAt : null, // The oldest message in this batch
      otherUser: {
        _id: otherUser._id,
        name: otherUser.name,
        email: otherUser.email
      }
    });

  } catch (error) {
    console.error("getChatHistory error", error);
    return res.status(500).json({
      success: false,
      message: "Server Error retrieving chat history",
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET ALL CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all conversations (list of users with latest message)
 * 
 * @route GET /api/v1/messages/conversations/all
 * @returns Array of conversations
 */
export const getConversations = async (req, res) => {
  try {
    const myId = req.user?._id || req.user?.userId;

    const cacheKey = `conversations:${myId}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: 'Conversations fetched from cache',
        data: cachedData,
        count: cachedData.length
      });
    }

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: myId },
            { receiverId: myId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', myId] },
              '$receiverId',
              '$senderId'
            ]
          },
          lastMessage: { $first: '$message' },
          lastMessageTime: { $first: '$createdAt' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiverId', myId] },
                    { $eq: ['$read', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $sort: { lastMessageTime: -1 }
      }
    ]);

    await setCache(cacheKey, conversations, 60);

    return res.status(200).json({
      success: true,
      data: conversations,
      count: conversations.length
    });

  } catch (error) {
    console.error('getConversations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching conversations'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MARK PRIVATE MESSAGES AS READ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mark private messages as read
 * 
 * @route PUT /api/v1/messages/read/:userId
 */
export const markAsRead = async (req, res) => {
  try {
    const myId = req.user?._id || req.user?.userId;
    const otherUserId = req.params.userId;

    await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: myId,
        read: false
      },
      { read: true }
    )

    return res.status(200).json({
      success: true,
      message: "Messages marked as read"
    });

  } catch (error) {
    console.error('markAsRead error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Delete a message
 * 
 * @route DELETE /api/v1/messages/:messageId
 */
export const deleteMessage = async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const myId = req.user?._id || req.user?.userId
    const message = await Message.findById(messageId);

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID format"
      })
    }

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      })
    }

    if (message.senderId.toString() !== myId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'you can only delete your own message'
      });
    }

    await Message.findByIdAndDelete(messageId)

    return res.status(200).json({
      success: true,
      message: 'message deleted'
    })
  } catch (error) {
    console.error('deleteMessage error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEND PRIVATE MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send private message
 * 
 * @route POST /api/v1/messages/private
 */
export const sendPrivateMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.userId;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'receiverId is required for private messages'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    const savedMsg = await Message.create({
      senderId,
      receiverId,
      message: message.trim(),
      chatType: 'private'
    });

    return res.status(201).json({
      success: true,
      data: savedMsg
    });

  } catch (error) {
    console.error('Send message error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEND GROUP MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send group message
 * 
 * @route POST /api/v1/messages/group
 */
export const sendGroupMessage = async (req, res) => {
  try {
    const { groupId, message } = req.body;
    const senderId = req.user.userId;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'groupId is required for group messages'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    const savedMsg = await Message.create({
      senderId,
      groupId,
      message: message.trim(),
      chatType: 'group'
    });

    return res.status(201).json({
      success: true,
      data: savedMsg
    });

  } catch (error) {
    console.error('Send message error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MARK GROUP MESSAGES AS READ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mark all group messages as read
 * 
 * @route PUT /api/v1/messages/group/:groupId/read
 * @param groupId - Group ID
 * @access Private
 * 
 * Features:
 * - Mark all unread messages in group as read
 * - User must be group member
 * - Only marks messages NOT sent by current user
 */
export const markGroupMessagesAsRead = async (req, res) => {
  try {
    const { groupId } = req.params;
    const myId = req.user?.userId || req.user?._id;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID format'
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const myObjId = toObjectId(myId);
    const isMember = group.participants.some(
      p => p.toString() === myObjId.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    const result = await Message.updateMany(
      {
        groupId: groupId,
        chatType: 'group',
        senderId: { $ne: myObjId },  
        'readBy.userId': { $ne: myObjId }
      },
      {
        $push: {
          readBy: {
            userId: myObjId,
            readAt: new Date()
          }
        },
        $set: { read: true } 
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Group messages marked as read',
      markedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Mark group messages as read error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
};


export const getMessageReadReceipts = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({
        success: false,
        message: "invalid message ID format"
      })
    }

    const message = await Message.findById(messageId)
      .populate('readBy.userId', 'name email');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'message not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        messageId: message._id,
        readBy: message.readBy || [],
        readCount: (message.readBy || []).length
      }
    });

  } catch (error) {
    console.error('get read recipt error: ', error.message)
    return res.status(500).json({
      success: false,
      message: "failed to fetch read recipts"
    });
  }
};