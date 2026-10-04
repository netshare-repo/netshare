import crypto from 'crypto';

/**
 * Assigns a unique request ID to each incoming HTTP request.
 * Accepts existing X-Request-ID header if present (trusted upstream).
 * Adds requestId to req object and response headers.
 */
export const requestIdMiddleware = (req, res, next) => {
  const existingId = req.headers['x-request-id'];
  const requestId = existingId || `req_${crypto.randomUUID()}`;
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

export default requestIdMiddleware;
