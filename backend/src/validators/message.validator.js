import Joi from 'joi';

const objectId = () => Joi.string().hex().length(24).messages({
  'string.hex': 'Must be a valid ID',
  'string.length': 'Must be a valid ID',
  'string.empty': 'Required'
});

export const SendPrivateMessageSchema = Joi.object({
  receiverId: objectId()
    .required()
    .messages({
      'any.required': 'receiverId is required for private messages'
    }),

  message: Joi.string()
    .min(1)
    .max(10000)
    .required()
    .messages({
      'string.empty': 'Message cannot be empty',
      'string.max': 'Message cannot exceed 10000 characters',
      'any.required': 'Message cannot be empty'
    }),

  isEncrypted: Joi.boolean().optional()
});

export const SendGroupMessageSchema = Joi.object({
  groupId: objectId()
    .required()
    .messages({
      'any.required': 'groupId is required for group messages'
    }),

  isEncrypted: Joi.boolean().optional().default(false),

  // Plaintext path: required unless this is an encrypted group message.
  message: Joi.string()
    .min(1)
    .max(10000)
    .when('isEncrypted', { is: true, then: Joi.optional(), otherwise: Joi.required() })
    .messages({
      'string.empty': 'Message cannot be empty',
      'string.max': 'Message cannot exceed 10000 characters',
      'any.required': 'Message cannot be empty'
    }),

  // Encrypted path: one NaCl-box ciphertext per current group member
  // (memberId -> ciphertext), fanned out client-side. See docs/audit/07.
  ciphertexts: Joi.object()
    .pattern(/^[0-9a-fA-F]{24}$/, Joi.string().min(1).max(20000))
    .min(1)
    .when('isEncrypted', { is: true, then: Joi.required(), otherwise: Joi.forbidden() })
    .messages({
      'any.required': 'ciphertexts is required for encrypted group messages',
      'object.min': 'ciphertexts cannot be empty'
    })
});
