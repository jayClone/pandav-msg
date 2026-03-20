import mongoose from "mongoose";

const friendSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, 
    },
    
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, 
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "blocked"],
      default: "pending",
      index: true, 
    },

    createdAt: {
      type: Date,
      default: null,
      index: true, 
    },

    acceptedAt: {
      type: Date,
      default: null
    },
  },
  { timestamps: true }
);


friendSchema.index({ senderId: 1, receiverId: 1 }, { unique: true, sparse: true });

friendSchema.index({ receiverId: 1, status: 1, createdAt: -1 });

friendSchema.index({ senderId: 1, status: 1, createdAt: -1 });

friendSchema.index({ senderId: 1, receiverId: 1, status: 1 });

export default mongoose.model("Friend", friendSchema);