import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    index: true
  },
  
  otp: {
    type: String,
    required: [true, 'OTP is required'],
    length: 6
  },
  
  purpose: {
    type: String,
    enum: ['registration', 'login', 'password-reset'],
    default: 'authentication'
  },
  
  attempts: {
    type: Number,
    default: 0,
    max: [5, 'Maximum verification attempts exceeded']
  },
  
  verified: {
    type: Boolean,
    default: false,
    index: true 
  },
  
  expiresAt: {
    type: Date,
    required: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

otpSchema.index({ email: 1, purpose: 1 });

otpSchema.index({ email: 1, verified: 1 });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OTP', otpSchema);