import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false  // Don't return password by default
  },

  isOnline: {
      type: Boolean,
      default: false
    },
    
  lastSeen: {
      type: Date,
      default: Date.now
    },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

//  Hash password BEFORE saving
// Using proper Mongoose pre-save hook syntax
userSchema.pre('save', async function() {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return;  //  Just return, don't call next()
  }

  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    // Throw error instead of passing to next()
    throw new Error(`Password hashing failed: ${error.message}`);
  }
});

// ✅ Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error.message);
    return false;
  }
};

export default mongoose.model('User', userSchema);