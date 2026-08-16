/**
 * Sends a 500 response whose message is gated by NODE_ENV, matching the
 * global error handler in app.js. Controllers that catch their own errors
 * (instead of letting them bubble to the global handler) were previously
 * echoing `error.message` back to the client unconditionally in every
 * environment, which can leak Mongoose/driver internals in production.
 */
export const sendServerError = (res, error, fallbackMessage = 'Something went wrong') => {
  const isDev = process.env.NODE_ENV === 'development';

  return res.status(500).json({
    success: false,
    message: isDev ? error.message : fallbackMessage,
    ...(isDev && error?.stack && { stack: error.stack })
  });
};
