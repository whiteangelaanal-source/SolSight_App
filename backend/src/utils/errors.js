const logger = require('./logger');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

class BlockchainError extends AppError {
  constructor(message = 'Blockchain operation failed', transactionHash = null) {
    super(message, 500, 'BLOCKCHAIN_ERROR');
    this.transactionHash = transactionHash;
  }
}

class WebRTCError extends AppError {
  constructor(message = 'WebRTC operation failed', roomId = null) {
    super(message, 500, 'WEBRTC_ERROR');
    this.roomId = roomId;
  }
}

class MatchingError extends AppError {
  constructor(message = 'Volunteer matching failed') {
    super(message, 500, 'MATCHING_ERROR');
  }
}

// Error handler middleware
const errorHandler = (error, req, res, next) => {
  // Log the error
  logger.logError(error, {
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
    userId: req.user?.id,
  });

  // Determine if this is an operational error
  const isOperational = error.isOperational || false;

  // Prepare error response
  let statusCode = error.statusCode || 500;
  let errorCode = error.errorCode || 'INTERNAL_ERROR';
  let message = error.message || 'Internal server error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (error.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_RESOURCE';
    message = 'Resource already exists';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
  }

  // Prepare response object
  const response = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
  };

  // Add field information for validation errors
  if (error.field) {
    response.error.field = error.field;
  }

  // Add transaction hash for blockchain errors
  if (error.transactionHash) {
    response.error.transactionHash = error.transactionHash;
  }

  // Add room ID for WebRTC errors
  if (error.roomId) {
    response.error.roomId = error.roomId;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && !isOperational) {
    response.error.stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(response);
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error helper
const handleValidationError = (error) => {
  if (error.details && Array.isArray(error.details)) {
    const firstError = error.details[0];
    throw new ValidationError(firstError.message, firstError.path);
  }
  throw new ValidationError(error.message);
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BlockchainError,
  WebRTCError,
  MatchingError,
  errorHandler,
  asyncHandler,
  handleValidationError,
};