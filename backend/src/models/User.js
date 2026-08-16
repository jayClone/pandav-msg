import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    index: true 
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
    select: false  
  },
  refreshToken: {
    type: String,
    default: null,
    select: false
  },
  publicKey: {
    type: String,
    default: null,
    trim: true
  },

  isOnline: {
    type: Boolean,
    default: false,
    index: true  
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

userSchema.index({ email: 1, isOnline: 1 });

// Text index backing $text search in searchUsers — see docs/audit/06 for why
// this replaced an unanchored $regex scan, and the search-semantics tradeoff
// that comes with it (word/token matching, not substring/prefix matching).
userSchema.index({ name: 'text', email: 'text' });

userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return; 
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error.message);
    return false;
  }
};

export default mongoose.model('User', userSchema);
