import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true  // ✅ ADD: For sender-based queries
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true  // ✅ ADD: For receiver-based queries
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      index: true  // ✅ ADD: For group-based queries
    },

    chatType: {
      type: String,
      enum: ['private', 'group'],
      default: 'private',
      required: true,
      index: true  // ✅ ADD: Filter by chat type early
    },

    message: {
      type: String,
      required: [true, 'Message cannot be empty'],
      trim: true 
    },

    // ✅ For backward compatibility with private chat
    read: {
      type: Boolean,
      default: false,
      index: true  // ✅ ADD: For read status queries
    },
    
    // ✅ Detailed read receipt tracking
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ✅ Track delivery status for private messages
    delivered: {
      type: Boolean,
      default: false
    },

    // ✅ Allow message deletion (soft delete)
    deleted: {
      type: Boolean,
      default: false,
      index: true  // ✅ ADD: Filter deleted messages early
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// ✅ CRITICAL PERFORMANCE INDEXES (ordered by importance)

// 1️⃣ Group messages (most frequent query)
messageSchema.index({ groupId: 1, chatType: 1, deleted: 1, createdAt: -1 });

// 2️⃣ Private messages (second most frequent)
messageSchema.index({ senderId: 1, receiverId: 1, chatType: 1, createdAt: -1 });

// 3️⃣ Read receipts
messageSchema.index({ 'readBy.userId': 1 });

// 4️⃣ Deleted messages filter
messageSchema.index({ groupId: 1, deleted: 1 });

// 5️⃣ Sender queries
messageSchema.index({ senderId: 1, createdAt: -1 });

// 6️⃣ Read status queries
messageSchema.index({ chatType: 1, read: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
