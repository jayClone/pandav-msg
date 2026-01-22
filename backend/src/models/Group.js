import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
    {

    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [3, 'Group name must be at least 3 characters'],
      maxlength: [50, 'Group name cannot exceed 50 characters']
    },

    participants: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      required: [true, 'Participants are required'],
      validate: {
        validator: function(v) {
          return v.length >= 2;
        },
        message: 'Group must have at least 2 participants'
      }
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin is required']
    },
        
    createdAt: {
      type: Date,
      default: Date.now
    }
},
    {
        timestamps: true
    }
);

// Index for faster queries
groupSchema.index({ participants: 1 });
groupSchema.index({ adminId: 1 });

export default mongoose.model("Group", groupSchema)