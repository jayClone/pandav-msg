import mongoose  from "mongoose";

const friendSchema = new mongoose.Schema(
    {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // User who receives the request
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
        type: String,
        enum : ['pending', 'accepted', 'blocked'],
        default: 'pending',
    },

    createdAt: {
        type: Date,
        default: null,
    },

    acceptedAt: {
        type: Date,
        default: null,
    },
    },
    {timestamps: true}
);

// compound index to prevent duplicate request
friendSchema.index({ senderId: 1, receiverId:1}, {unique: true});

//index for quick lookup
friendSchema.index({receiverId: 1, status:1});
friendSchema.index({senderId: 1, status: 1});

export default mongoose.model('Friend', friendSchema);