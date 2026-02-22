import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
      minlength: [3, "Group name must be at least 3 characters"],
      maxlength: [50, "Group name cannot exceed 50 characters"],
      index: true, // ✅ ADD: For name searches
    },

    participants: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      required: [true, "Participants are required"],
      validate: {
        validator: function (v) {
          return v.length >= 1;
        },
        message: "Group must have at least 1 participant",
      },
      index: true, // ✅ KEEP: For finding groups by participant
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Admin is required"],
      index: true, // ✅ ADD: For admin-based queries
    },

    // ✅ NEW: Track online members in real-time
    onlineMembers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
      // Don't index - changes too frequently
    },

    // ✅ NEW: Track read receipts per message
    messageReadReceipts: [
      {
        messageId: mongoose.Schema.Types.ObjectId,
        readBy: [
          {
            userId: mongoose.Schema.Types.ObjectId,
            readAt: Date,
          },
        ],
      },
    ],

    createdAt: {
      type: Date,
      default: Date.now,
      index: true, // ✅ ADD: For sorting by creation time
    },
  },
  {
    timestamps: true,
  }
);

// ✅ COMPOUND INDEXES for common queries

// 1️⃣ Find groups by participant + creation time
groupSchema.index({ participants: 1, createdAt: -1 });

// 2️⃣ Find groups by admin
groupSchema.index({ adminId: 1, createdAt: -1 });

// 3️⃣ Find groups by admin + participant (for membership checks)
groupSchema.index({ adminId: 1, participants: 1 });

// 4️⃣ Message read receipts
groupSchema.index({ "messageReadReceipts.messageId": 1 });

export default mongoose.model("Group", groupSchema);