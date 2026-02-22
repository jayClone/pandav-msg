export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: false,  // ✅ IMPORTANT: Set to false to preserve all fields
      allowUnknown: true     // ✅ Allow extra fields
    });

    if (error) {
      const messages = error.details.map(d => d.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }

    // ✅ Preserve the original body with all fields
    req[source] = { ...req[source], ...value };
    next();
  };
};