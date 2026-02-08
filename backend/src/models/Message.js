import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
    },

    chatType: {
      type: String,
      enum: ['private', 'group'],
      default: 'private',
      required: true
    },

    message: {
      type: String,
      required: [true, 'Message cannot be empty'],
      trim: true 
    },

    // ✅ For backward compatibility with private chat
    read: {
      type: Boolean,
      default: false
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
      default: false
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Performance indexes
messageSchema.index({ groupId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ 'readBy.userId': 1 });
messageSchema.index({ groupId: 1, deleted: 1 });

export default mongoose.model('Message', messageSchema);
