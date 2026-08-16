import { sanitize } from 'express-mongo-sanitize';

/**
 * Strips Mongo operator keys ($..., a.b) from req.body/params/query.
 *
 * Not express-mongo-sanitize's own middleware() export: that reassigns
 * `req.query = ...`, which throws in Express 5 because req.query is defined
 * as a getter-only accessor with no setter. sanitize() mutates the target
 * object's own keys in place and returns the same reference, so calling it
 * for its side effects (and never reassigning req.query itself) avoids that
 * crash while still removing the dangerous keys.
 */
export const sanitizeRequest = (req, res, next) => {
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  if (req.query) sanitize(req.query);
  next();
};

export default sanitizeRequest;
