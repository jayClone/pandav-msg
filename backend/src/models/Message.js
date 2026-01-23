import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required']
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group'
    },

    chatType: {
      type: String,
      enum: ['private', 'group'],
      default: 'private'
    },

    message: {
      type: String,
      required: [true, 'Message cannot be empty'],
      trim: true 
    },

    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Indexes only
messageSchema.index({ groupId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, receiverId: 1 });

export default mongoose.model('Message', messageSchema);
