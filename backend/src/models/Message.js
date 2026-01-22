import mongoose from "mongoose"

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true // fast queries 
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    groupId:{
      type : mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null
    },
    chatType:{
      type: String,
      enum: ['private', 'group'],
      default: 'private'
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000
    },
    read:{
      type: Boolean,
      default: false
    }
  },
  { timestamps: true } // creates createdAt + updatedAt automatically
);

// index for faster chat retrieval
messageSchema.index({senderId:1, receiverId:1, createdAt: -1})
messageSchema.index({ senderId: 1, groupId: 1 });

export default mongoose.model("Message", messageSchema);
