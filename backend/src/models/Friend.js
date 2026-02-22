import mongoose from "mongoose";

const friendSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // ✅ ADD: For sender-based queries
    },
    
    // User who receives the request
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // ✅ ADD: For receiver-based queries
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "blocked"],
      default: "pending",
      index: true, // ✅ ADD: Filter by status early
    },

    createdAt: {
      type: Date,
      default: null,
      index: true, // ✅ ADD: For sorting by creation time
    },

    acceptedAt: {
      type: Date,
      default: null
    },
  },
  { timestamps: true }
);

// ✅ COMPOUND INDEXES (ordered by query frequency)

// 1️⃣ Prevent duplicate requests + quick lookup
friendSchema.index({ senderId: 1, receiverId: 1 }, { unique: true, sparse: true });

// 2️⃣ Find pending requests for user (MOST COMMON)
friendSchema.index({ receiverId: 1, status: 1, createdAt: -1 });

// 3️⃣ Find sent requests by user
friendSchema.index({ senderId: 1, status: 1, createdAt: -1 });

// 4️⃣ Find accepted friends (for group creation validation)
friendSchema.index({ senderId: 1, receiverId: 1, status: 1 });

export default mongoose.model("Friend", friendSchema);