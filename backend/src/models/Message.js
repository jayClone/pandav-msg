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
      // Not required for encrypted group messages, which carry their
      // content in groupCiphertexts instead (see below) — every other
      // message (private, or an unencrypted group message) still needs it.
      required: [
        function () {
          return !(this.chatType === 'group' && this.groupCiphertexts && this.groupCiphertexts.size > 0);
        },
        'Message cannot be empty'
      ],
      maxlength: [10000, 'Message cannot exceed 10000 characters'],
      trim: true
    },

    // Group E2EE: one NaCl-box ciphertext of the same plaintext per current
    // group member (including the sender, so they can re-read their own
    // sent messages later), keyed by member userId. Mirrors the private
    // message model's single ciphertext, just fanned out per recipient
    // since a group has more than one. Only set when isEncrypted && chatType
    // === 'group'.
    groupCiphertexts: {
      type: Map,
      of: {
        type: String,
        maxlength: [20000, 'Ciphertext is too large']
      },
      validate: {
        validator: (map) => !map || map.size <= 200,
        message: 'groupCiphertexts cannot cover more than 200 members'
      },
      default: undefined
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
