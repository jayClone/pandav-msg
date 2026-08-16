import Joi from 'joi';

// Restricting `purpose` to this enum is what actually closes the NoSQL
// operator-injection surface (e.g. { "purpose": { "$ne": "x" } }) — Joi
// rejects anything that isn't one of these exact strings before it ever
// reaches a Mongo query.
const purpose = Joi.string().valid('registration', 'login', 'password-reset');

// `name` only exists to personalize the email greeting — for password-reset
// the client doesn't know (and a real forgot-password form shouldn't ask
// for) the account holder's name, so it's optional there; the controller
// falls back to the account's real name. Still required for
// registration/login, where the client does have it.
const nameForPurpose = Joi.string().trim().min(1).max(100).when('purpose', {
  // .allow('', null) alongside .optional(): Joi's `.optional()` only skips
  // validation when the key is *absent* — a client that sends an empty
  // string (present, just empty) would otherwise still fail the `.min(1)`
  // underneath. Belt-and-braces for whatever a caller actually sends.
  is: 'password-reset',
  then: Joi.optional().allow('', null),
  otherwise: Joi.required().messages({ 'string.empty': 'Name is required' })
});

export const SendOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'string.empty': 'Email is required'
  }),
  name: nameForPurpose,
  purpose: purpose.default('registration')
});

export const VerifyOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'string.empty': 'Email is required'
  }),
  otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'OTP must be 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
    'string.empty': 'OTP is required'
  }),
  purpose: purpose.default('registration')
});

export const ResendOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email',
    'string.empty': 'Email is required'
  }),
  name: Joi.string().trim().min(1).max(100).optional().allow('', null),
  purpose: purpose.default('registration')
});
