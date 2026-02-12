export const validate = (schema, property = 'body') => {
  return async (req, res, next) => {
    try {
      const value = req[property];
      const { error, value: validated } = schema.validate(value, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }

      req[property] = validated;
      next();
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
};