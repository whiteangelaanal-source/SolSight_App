const jwt = require('jsonwebtoken');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const { getUser } = require('../config/database');
const config = require('../config/server');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new AuthenticationError('Access token required');
    }

    // Verify the token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Get user from database
    const user = await getUser(decoded.userId);
    if (!user) {
      throw new AuthenticationError('Invalid token - user not found');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AuthenticationError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

// Check user role
const requireRole = (userType) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (req.user.userType !== userType) {
      throw new AuthorizationError(`${userType} access required`);
    }

    next();
  };
};

// Check if user is blind or volunteer (for mixed access)
const requireUser = (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }

  if (!['blind', 'volunteer'].includes(req.user.userType)) {
    throw new AuthorizationError('Invalid user type');
  }

  next();
};

// Optional authentication (doesn't throw error if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await getUser(decoded.userId);

      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Optional auth - don't throw errors, just continue without user
    next();
  }
};

// Check if user owns the resource or is admin
const requireOwnership = (resourceIdParam = 'id', resourceType = 'resource') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AuthenticationError('Authentication required'));
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;

      // Admin users can access any resource
      if (req.user.userType === 'admin') {
        return next();
      }

      // Check ownership logic would go here
      // This is a basic example - you'd fetch the resource and check owner
      if (resourceId !== userId) {
        throw new AuthorizationError(`Access denied to this ${resourceType}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Rate limiting for authentication endpoints
const authRateLimit = (req, res, next) => {
  // This would be implemented with a rate limiting library
  // For now, just pass through
  next();
};

// Verify refresh token
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token required');
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const user = await getUser(decoded.userId);

    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid refresh token');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AuthenticationError('Invalid refresh token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Refresh token expired'));
    } else {
      next(error);
    }
  }
};

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireUser,
  optionalAuth,
  requireOwnership,
  authRateLimit,
  verifyRefreshToken,
  generateTokens,
};