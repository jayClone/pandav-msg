import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
      minlength: [3, "Group name must be at least 3 characters"],
      maxlength: [50, "Group name cannot exceed 50 characters"],
      index: true,
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
      index: true, 
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Admin is required"],
      index: true, 
    },

    onlineMembers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },

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
      index: true,
    },
  },
  {
    timestamps: true,
  }
);


groupSchema.index({ participants: 1, createdAt: -1 });

groupSchema.index({ adminId: 1, createdAt: -1 });

groupSchema.index({ adminId: 1, participants: 1 });

groupSchema.index({ "messageReadReceipts.messageId": 1 });

export default mongoose.model("Group", groupSchema);