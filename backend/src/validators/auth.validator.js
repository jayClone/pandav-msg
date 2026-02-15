import Joi from 'joi';

// ✅ REGISTER SCHEMA - MUST INCLUDE OTP
export const RegisterSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must not exceed 50 characters'
    }),

  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Please provide a valid email',
      'string.empty': 'Email is required'
    }),

  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, number, and special character',
      'string.min': 'Password must be at least 8 characters',
      'string.empty': 'Password is required'
    }),

  // ✅ ADD OTP FIELD - THIS IS KEY!
  otp: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'string.empty': 'OTP is required'
    })
});

// ✅ LOGIN SCHEMA
export const LoginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Please provide a valid email',
      'string.empty': 'Email is required'
    }),

  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
    })
});