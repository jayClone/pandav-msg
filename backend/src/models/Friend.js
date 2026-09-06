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

    // Sorted `${senderId}_${receiverId}` — the same value regardless of who
    // sent the request. senderId/receiverId alone can't prevent two users
    // sending each other requests at nearly the same moment (A→B and B→A
    // are different index keys), which used to let two separate pending
    // Friend docs, and later two accepted ones, exist for the same pair.
    // Set only on newly created requests (see friend.controller.js); the
    // partial index below leaves pre-existing rows without this field
    // untouched, so no backfill/migration is required.
    pairKey: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);


friendSchema.index({ senderId: 1, receiverId: 1 }, { unique: true, sparse: true });

friendSchema.index(
  { pairKey: 1 },
  { unique: true, partialFilterExpression: { pairKey: { $type: 'string' } } }
);

friendSchema.index({ receiverId: 1, status: 1, createdAt: -1 });

friendSchema.index({ senderId: 1, status: 1, createdAt: -1 });

friendSchema.index({ senderId: 1, receiverId: 1, status: 1 });

// Supports getFriends/getFriendshipSummary, which query accepted friendships
// via $or on senderId/receiverId and sort by acceptedAt — the indexes above
// only cover createdAt, so that sort was previously unindexed.
friendSchema.index({ senderId: 1, status: 1, acceptedAt: -1 });
friendSchema.index({ receiverId: 1, status: 1, acceptedAt: -1 });

export default mongoose.model("Friend", friendSchema);