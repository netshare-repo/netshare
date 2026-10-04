import logger from '../lib/logger.js';
import config from '../config/env.js';

/**
 * Custom application error class with stable error codes.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

/**
 * Map Mongoose/MongoDB errors to user-safe responses.
 */
const classifyError = (err) => {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message).join(', ');
    return { statusCode: 400, code: 'VALIDATION_ERROR', message: messages };
  }
  
  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return { statusCode: 409, code: 'DUPLICATE_ENTRY', message: `A record with this ${field} already exists.` };
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return { statusCode: 401, code: 'INVALID_TOKEN', message: 'Invalid or malformed token.' };
  }
  if (err.name === 'TokenExpiredError') {
    return { statusCode: 401, code: 'TOKEN_EXPIRED', message: 'Token has expired.' };
  }
  
  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return { statusCode: 400, code: 'INVALID_ID', message: `Invalid ${err.path}: ${err.value}` };
  }
  
  // Our custom AppError
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message };
  }
  
  // Default
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: config.isProduction ? 'An unexpected error occurred.' : err.message,
  };
};

/**
 * Express error-handling middleware (4-argument signature).
 */
export const errorHandler = (err, req, res, _next) => {
  const classified = classifyError(err);
  
  // Log with structured context
  const logContext = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode: classified.statusCode,
    errorCode: classified.code,
    userId: req.user?._id?.toString(),
  };
  
  if (classified.statusCode >= 500) {
    logger.error({ ...logContext, err }, `Unhandled error: ${err.message}`);
  } else {
    logger.warn(logContext, `Client error: ${classified.message}`);
  }
  
  // Never expose stack traces or internal details in production
  const response = {
    success: false,
    error: {
      code: classified.code,
      message: classified.message,
      requestId: req.requestId,
    },
  };
  
  if (!config.isProduction && err.stack) {
    response.error.stack = err.stack;
  }
  
  res.status(classified.statusCode).json(response);
};

/**
 * 404 handler for unmatched routes.
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found.`,
      requestId: req.requestId,
    },
  });
};

export default { errorHandler, notFoundHandler, AppError };
