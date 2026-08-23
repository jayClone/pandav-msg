import Joi from 'joi';

// A data: URL — "data:image/<type>;base64,<payload>". Capped well under the
// User model's own 700_000-char maxlength so a rejected upload gets a clear
// Joi message instead of a generic Mongoose validation error, and checked
// server-side as a hard backstop even though the client compresses first.
export const UpdateAvatarSchema = Joi.object({
  avatarData: Joi.string()
    .pattern(/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/]+=*$/)
    .max(700_000)
    .required()
    .messages({
      'string.pattern.base': 'avatarData must be a base64 image data URL (png/jpeg/webp/gif)',
      'string.max': 'Avatar image is too large',
      'string.empty': 'avatarData is required'
    })
});
