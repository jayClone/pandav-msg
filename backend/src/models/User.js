import mongoose from "mongoose";
import validator from 'validator';
import bycrypt from 'bcryptjs'
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    name:{
      type: String,
      required: [true, 'Please Enter your Name'],
      trim : true
    },
    email:{
        type: String,
        required: [true, 'Please Provide Email'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please enter valid email']
    },
    password:{
        type: String,
        required: [true, 'please provide password'],
        minlength: 6,
        select: false
    },
    createdAt:{
        type: Date,
        default: Date.now
    }
})

// hash the password now
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')){
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt)
    } catch (error) {
        next(error)
    }
});

// method to compare the password
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema)
export default User