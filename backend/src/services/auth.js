const bcrypt = require('bcryptjs');
const { createUser, getUserByEmail, updateUser } = require('../config/database');
const { AuthenticationError, ValidationError, ConflictError } = require('../utils/errors');
const { generateTokens } = require('../middleware/auth');
const { validateEmail, validatePhone } = require('../middleware/validation');
const { logger } = require('../utils/logger');

class AuthService {
  // Hash password
  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, 12);
    } catch (error) {
      logger.error('Error hashing password:', error);
      throw new ValidationError('Failed to process password');
    }
  }

  // Compare password
  async comparePassword(password, hashedPassword) {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      logger.error('Error comparing password:', error);
      throw new ValidationError('Failed to validate password');
    }
  }

  // Register new user
  async register(userData) {
    try {
      const { email, password, firstName, lastName, userType, phone } = userData;

      // Validate input
      if (!validateEmail(email)) {
        throw new ValidationError('Invalid email address');
      }

      if (!validatePhone(phone)) {
        throw new ValidationError('Invalid phone number format');
      }

      if (!['blind', 'volunteer'].includes(userType)) {
        throw new ValidationError('User type must be blind or volunteer');
      }

      // Check if user already exists
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create user
      const newUser = await createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        userType,
        phone,
        reputationScore: userType === 'volunteer' ? 100 : 0, // Volunteers start with base reputation
        totalCalls: 0,
        totalHelpMinutes: 0,
        isVerified: false,
        isActive: true,
        isAvailable: userType === 'volunteer', // Volunteers are available by default
      });

      logger.info(`New user registered: ${email} (${userType})`);

      // Generate tokens
      const tokens = generateTokens(newUser.id);

      // Return user without sensitive data
      const { passwordHash: _, ...userWithoutPassword } = newUser;

      return {
        user: userWithoutPassword,
        ...tokens,
      };
    } catch (error) {
      logger.error('Registration error:', { error: error.message, email: userData.email });
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      // Validate input
      if (!validateEmail(email)) {
        throw new ValidationError('Invalid email address');
      }

      if (!password) {
        throw new ValidationError('Password is required');
      }

      // Get user by email
      const user = await getUserByEmail(email);
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Verify password
      const isValidPassword = await this.comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Update last login
      await updateUser(user.id, {
        lastLoginAt: new Date().toISOString(),
      });

      logger.info(`User logged in: ${email} (${user.userType})`);

      // Generate tokens
      const tokens = generateTokens(user.id);

      // Return user without sensitive data
      const { passwordHash: _, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        ...tokens,
      };
    } catch (error) {
      logger.error('Login error:', { error: error.message, email });
      throw error;
    }
  }

  // Refresh tokens
  async refreshToken(userId) {
    try {
      if (!userId) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Get user to ensure they still exist and are active
      const user = await getUser(userId);
      if (!user || !user.isActive) {
        throw new AuthenticationError('User not found or inactive');
      }

      // Generate new tokens
      const tokens = generateTokens(userId);

      logger.info(`Tokens refreshed for user: ${user.email}`);

      return tokens;
    } catch (error) {
      logger.error('Token refresh error:', { error: error.message, userId });
      throw error;
    }
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    try {
      if (!currentPassword || !newPassword) {
        throw new ValidationError('Current password and new password are required');
      }

      if (newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters long');
      }

      // Get user
      const user = await getUser(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Verify current password
      const isValidCurrentPassword = await this.comparePassword(currentPassword, user.passwordHash);
      if (!isValidCurrentPassword) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await updateUser(userId, {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date().toISOString(),
      });

      logger.info(`Password changed for user: ${user.email}`);

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      logger.error('Password change error:', { error: error.message, userId });
      throw error;
    }
  }

  // Reset password (simplified - in production you'd want email verification)
  async resetPassword(email) {
    try {
      if (!validateEmail(email)) {
        throw new ValidationError('Invalid email address');
      }

      const user = await getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        return { success: true, message: 'If an account with that email exists, a reset link has been sent' };
      }

      // Generate temporary password (in production, use secure tokens)
      const tempPassword = Math.random().toString(36).slice(-8);
      const tempPasswordHash = await this.hashPassword(tempPassword);

      // Update user with temporary password
      await updateUser(user.id, {
        passwordHash: tempPasswordHash,
        isVerified: false, // User must verify after reset
        passwordResetAt: new Date().toISOString(),
      });

      // In production, send email with temporary password
      logger.info(`Password reset initiated for user: ${email}`);

      // For development, return the temporary password
      if (process.env.NODE_ENV !== 'production') {
        return {
          success: true,
          message: 'Temporary password generated (check logs)',
          tempPassword, // Only for development
        };
      }

      return { success: true, message: 'If an account with that email exists, a reset link has been sent' };
    } catch (error) {
      logger.error('Password reset error:', { error: error.message, email });
      throw error;
    }
  }

  // Verify user account
  async verifyUser(userId) {
    try {
      await updateUser(userId, {
        isVerified: true,
        verifiedAt: new Date().toISOString(),
      });

      logger.info(`User verified: ${userId}`);

      return { success: true, message: 'Account verified successfully' };
    } catch (error) {
      logger.error('User verification error:', { error: error.message, userId });
      throw error;
    }
  }

  // Deactivate user account
  async deactivateUser(userId) {
    try {
      await updateUser(userId, {
        isActive: false,
        deactivatedAt: new Date().toISOString(),
      });

      logger.info(`User deactivated: ${userId}`);

      return { success: true, message: 'Account deactivated successfully' };
    } catch (error) {
      logger.error('User deactivation error:', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = new AuthService();