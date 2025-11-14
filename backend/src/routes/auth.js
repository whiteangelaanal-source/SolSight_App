const { authenticateToken, verifyRefreshToken, authRateLimit } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../utils/errors');
const authService = require('../services/auth');
const { logger } = require('../utils/logger');

const authRoutes = async (fastify) => {
  // Register new user
  fastify.post('/register', {
    preHandler: [
      authRateLimit,
      validate(schemas.userRegistration),
    ],
  }, asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    return res.status(201).json({
      success: true,
      data: result,
      message: 'User registered successfully',
    });
  }));

  // Login user
  fastify.post('/login', {
    preHandler: [
      authRateLimit,
      validate(schemas.userLogin),
    ],
  }, asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Login successful',
    });
  }));

  // Refresh tokens
  fastify.post('/refresh', {
    preHandler: [
      authRateLimit,
      verifyRefreshToken,
      validate(schemas.refreshToken),
    ],
  }, asyncHandler(async (req, res) => {
    const tokens = await authService.refreshToken(req.user.id);
    return res.status(200).json({
      success: true,
      data: tokens,
      message: 'Tokens refreshed successfully',
    });
  }));

  // Change password
  fastify.post('/change-password', {
    preHandler: [
      authenticateToken,
      authRateLimit,
    ],
  }, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Password changed successfully',
    });
  }));

  // Reset password request
  fastify.post('/reset-password', {
    preHandler: [
      authRateLimit,
    ],
  }, asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
        },
      });
    }

    const result = await authService.resetPassword(email);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Password reset request processed',
    });
  }));

  // Verify user account
  fastify.post('/verify', {
    preHandler: [
      authenticateToken,
    ],
  }, asyncHandler(async (req, res) => {
    const result = await authService.verifyUser(req.user.id);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Account verified successfully',
    });
  }));

  // Deactivate user account
  fastify.post('/deactivate', {
    preHandler: [
      authenticateToken,
    ],
  }, asyncHandler(async (req, res) => {
    const result = await authService.deactivateUser(req.user.id);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Account deactivated successfully',
    });
  }));

  // Get current user profile
  fastify.get('/profile', {
    preHandler: [
      authenticateToken,
    ],
  }, asyncHandler(async (req, res) => {
    // Return user data without sensitive information
    const { passwordHash, ...userProfile } = req.user;
    return res.status(200).json({
      success: true,
      data: userProfile,
      message: 'Profile retrieved successfully',
    });
  }));

  // Logout (client-side token invalidation)
  fastify.post('/logout', {
    preHandler: [
      authenticateToken,
    ],
  }, asyncHandler(async (req, res) => {
    logger.info(`User logged out: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  }));

  // Health check for auth service
  fastify.get('/health', async (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Auth service is healthy',
      timestamp: new Date().toISOString(),
    });
  });
};

module.exports = authRoutes;