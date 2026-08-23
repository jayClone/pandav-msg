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

    messageType: {
      type: String,
      enum: ['text', 'image', 'video'],
      default: 'text',
      index: true
    },

    message: {
      type: String,
      // Not required for encrypted *group* messages (text or image) — those
      // carry their per-member content in groupCiphertexts instead (see
      // below). Still required for private image messages: this field
      // holds the (small, NaCl-box-wrapped) content key for the single
      // recipient, mirroring how it holds the ciphertext for private text.
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

    // Image/video messages: the bulk media data is encrypted exactly *once*
    // with a random per-message symmetric key (NaCl secretbox), not fanned
    // out per recipient — `message`/`groupCiphertexts` above carry only
    // that small wrapped key (via the same NaCl-box code already used for
    // text), reusing the existing per-recipient/per-member key-distribution
    // instead of duplicating the whole media blob once per member. Keeps a
    // group media message's payload size independent of group size. Video
    // reuses these same three fields rather than adding a parallel set —
    // client-side transcoding (see videoCompression.js) already keeps
    // compressed video comfortably under this ceiling.
    imageCiphertext: {
      type: String,
      maxlength: [14_000_000, 'Media is too large'] // ~10MB raw media after base64 + secretbox overhead, under Mongo's 16MB document cap
    },

    imageNonce: {
      type: String
    },

    imageMimeType: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
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
    },

    // One reaction per user per message — toggling the same emoji again
    // removes it, picking a different one replaces it in place (see
    // reaction.handler.js). Emoji reactions are never encrypted: they're
    // not message content, just metadata about it.
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        emoji: {
          type: String,
          required: true,
          maxlength: [8, 'Invalid emoji'],
        },
      },
    ],
  },
  { timestamps: true }
);

messageSchema.pre('validate', function () {
  if (this.messageType === 'image' || this.messageType === 'video') {
    if (!this.imageCiphertext || !this.imageNonce || !this.imageMimeType) {
      throw new Error(`${this.messageType} messages require imageCiphertext, imageNonce, and imageMimeType`);
    }
  }
});


messageSchema.index({ groupId: 1, chatType: 1, deleted: 1, createdAt: -1 });

messageSchema.index({ senderId: 1, receiverId: 1, chatType: 1, createdAt: -1 });

messageSchema.index({ 'readBy.userId': 1 });

messageSchema.index({ groupId: 1, deleted: 1 });

messageSchema.index({ senderId: 1, createdAt: -1 });

messageSchema.index({ chatType: 1, read: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
