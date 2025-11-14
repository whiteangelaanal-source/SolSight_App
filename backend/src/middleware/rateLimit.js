const rateLimitStore = new Map();
const config = require('../config/server');
const { RateLimitError } = require('../utils/errors');
const { logger } = require('../utils/logger');

// Simple in-memory rate limiting
const createRateLimit = (options = {}) => {
  const {
    max = config.rateLimit.max,
    windowMs = config.rateLimit.windowMs,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Get current request count for this IP
    let requestData = rateLimitStore.get(key);

    if (!requestData) {
      requestData = {
        count: 0,
        resetTime: now + windowMs,
        windowStart: now,
      };
      rateLimitStore.set(key, requestData);
    }

    // Reset if window has passed
    if (now > requestData.resetTime) {
      requestData.count = 0;
      requestData.resetTime = now + windowMs;
      requestData.windowStart = now;
    }

    // Increment request count
    requestData.count++;

    // Log rate limit status periodically
    if (requestData.count % 10 === 0) {
      logger.debug(`Rate limit status for ${key}: ${requestData.count}/${max} requests`);
    }

    // Check if limit exceeded
    if (requestData.count > max) {
      // Clean up old entries periodically
      if (Math.random() < 0.01) { // 1% chance to clean up
        cleanupOldEntries();
      }

      const resetTime = Math.ceil((requestData.resetTime - now) / 1000);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': Math.max(0, max - requestData.count),
        'X-RateLimit-Reset': new Date(requestData.resetTime).toISOString(),
        'Retry-After': resetTime,
      });

      // Log rate limit exceeded
      logger.warn(`Rate limit exceeded for ${key}: ${requestData.count}/${max}`, {
        ip: key,
        url: req.url,
        method: req.method,
        userAgent: req.headers['user-agent'],
      });

      return next(new RateLimitError(message));
    }

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': Math.max(0, max - requestData.count),
      'X-RateLimit-Reset': new Date(requestData.resetTime).toISOString(),
    });

    // Continue to next middleware
    next();
  };
};

// Clean up old rate limit entries
const cleanupOldEntries = () => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.debug(`Cleaned up ${cleanedCount} old rate limit entries`);
  }
};

// Periodic cleanup
const cleanupInterval = setInterval(cleanupOldEntries, 60000); // Every minute

// Graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
});

process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
});

// Specific rate limits for different endpoints
const createAuthRateLimit = () => createRateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many authentication attempts, please try again later',
});

const createMatchingRateLimit = () => createRateLimit({
  max: 20,
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many matching requests, please try again later',
});

const createCallRateLimit = () => createRateLimit({
  max: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Call limit exceeded, please try again later',
});

const createBlockchainRateLimit = () => createRateLimit({
  max: 3,
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many blockchain transactions, please try again later',
});

// User-specific rate limiting
const createUserRateLimit = (maxRequests = 100, windowMs = 60 * 1000) => {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const key = `user:${req.user.id}`;
    const now = Date.now();

    let requestData = rateLimitStore.get(key);

    if (!requestData) {
      requestData = {
        count: 0,
        resetTime: now + windowMs,
        windowStart: now,
      };
      rateLimitStore.set(key, requestData);
    }

    if (now > requestData.resetTime) {
      requestData.count = 0;
      requestData.resetTime = now + windowMs;
      requestData.windowStart = now;
    }

    requestData.count++;

    if (requestData.count > maxRequests) {
      const resetTime = Math.ceil((requestData.resetTime - now) / 1000);

      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - requestData.count),
        'X-RateLimit-Reset': new Date(requestData.resetTime).toISOString(),
        'Retry-After': resetTime,
      });

      logger.warn(`User rate limit exceeded for ${req.user.id}: ${requestData.count}/${maxRequests}`, {
        userId: req.user.id,
        url: req.url,
        method: req.method,
      });

      return next(new RateLimitError('User rate limit exceeded, please try again later'));
    }

    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - requestData.count),
      'X-RateLimit-Reset': new Date(requestData.resetTime).toISOString(),
    });

    next();
  };
};

// WebSocket rate limiting
const createWebSocketRateLimit = (maxConnections = 5) => {
  const connectionCount = new Map();

  return (connection, req, next) => {
    const userId = connection.userId || connection.ip;
    const currentCount = connectionCount.get(userId) || 0;

    if (currentCount >= maxConnections) {
      logger.warn(`WebSocket connection limit exceeded for ${userId}: ${currentCount}/${maxConnections}`);
      return next(new RateLimitError('Too many concurrent connections'));
    }

    connectionCount.set(userId, currentCount + 1);

    // Decrement on disconnect
    connection.on('close', () => {
      const newCount = connectionCount.get(userId) - 1;
      if (newCount <= 0) {
        connectionCount.delete(userId);
      } else {
        connectionCount.set(userId, newCount);
      }
    });

    next();
  };
};

module.exports = {
  createRateLimit,
  createAuthRateLimit,
  createMatchingRateLimit,
  createCallRateLimit,
  createBlockchainRateLimit,
  createUserRateLimit,
  createWebSocketRateLimit,
};