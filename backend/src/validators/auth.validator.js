import Joi from 'joi';

export const RegisterSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(2)
    .max(50)
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  
  email: Joi.string()
    .required()
    .email()
    .messages({ 'string.email': 'Invalid email format' }),
  
  password: Joi.string()
    .required()
    .min(8)
    .pattern(/[A-Z]/)
    .pattern(/[0-9]/)
    .pattern(/[!@#$%^&*]/)
    .messages({
      'string.pattern.base': 'Password must contain uppercase, number, and special character'
    })
});

export const LoginSchema = Joi.object({
  email: Joi.string().required().email(),
  password: Joi.string().required()
});