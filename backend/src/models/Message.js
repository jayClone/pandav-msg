import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true 
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true 
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      index: true 
    },

    chatType: {
      type: String,
      enum: ['private', 'group'],
      default: 'private',
      required: true,
      index: true  
    },

    message: {
      type: String,
      required: [true, 'Message cannot be empty'],
      trim: true 
    },

    read: {
      type: Boolean,
      default: false,
      index: true  
    },
    
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

    delivered: {
      type: Boolean,
      default: false
    },

    deleted: {
      type: Boolean,
      default: false,
      index: true  
    },

    deletedAt: {
      type: Date,
      default: null
    },

    isEncrypted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);


messageSchema.index({ groupId: 1, chatType: 1, deleted: 1, createdAt: -1 });

messageSchema.index({ senderId: 1, receiverId: 1, chatType: 1, createdAt: -1 });

messageSchema.index({ 'readBy.userId': 1 });

messageSchema.index({ groupId: 1, deleted: 1 });

messageSchema.index({ senderId: 1, createdAt: -1 });

messageSchema.index({ chatType: 1, read: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
