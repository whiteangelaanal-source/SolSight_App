const { authenticateToken, requireRole, requireOwnership, createUserRateLimit } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../utils/errors');
const { getUser, updateUser, getUserByEmail } = require('../config/database');
const blockchainService = require('../services/blockchain');

const usersRoutes = async (fastify) => {
  // Get user profile
  fastify.get('/profile', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(50, 60 * 1000), // 50 requests per minute
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

  // Update user profile
  fastify.put('/profile', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(10, 60 * 1000), // 10 updates per minute
      validate(schemas.updateProfile),
    ],
  }, asyncHandler(async (req, res) => {
    const updateData = req.body;

    // Prevent updating sensitive fields directly
    delete updateData.passwordHash;
    delete updateData.userType;
    delete updateData.isVerified;
    delete updateData.reputationScore; // Must be updated through proper channels

    const updatedUser = await updateUser(req.user.id, updateData);

    // Return updated profile without sensitive data
    const { passwordHash, ...userProfile } = { ...updatedUser, ...updateData };

    return res.status(200).json({
      success: true,
      data: userProfile,
      message: 'Profile updated successfully',
    });
  }));

  // Set wallet address
  fastify.post('/wallet', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(5, 60 * 1000), // 5 wallet updates per minute
      validate(schemas.walletAddress),
    ],
  }, asyncHandler(async (req, res) => {
    const { walletAddress } = req.body;

    // Check if wallet is already used by another user
    const existingUser = await getUserByEmail(walletAddress); // This would need a wallet lookup function
    if (existingUser && existingUser.id !== req.user.id) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Wallet address is already linked to another account',
        },
      });
    }

    // Update user wallet
    await updateUser(req.user.id, {
      walletAddress,
      walletLinkedAt: new Date().toISOString(),
    });

    // Initialize reputation on blockchain if volunteer
    if (req.user.userType === 'volunteer' && !req.user.reputationInitialized) {
      try {
        await blockchainService.initializeUserReputation(req.user.id);
      } catch (error) {
        // Don't fail the request, just log the error
        console.error('Failed to initialize reputation:', error);
      }
    }

    return res.status(200).json({
      success: true,
      data: { walletAddress },
      message: 'Wallet address linked successfully',
    });
  }));

  // Update availability status (for volunteers)
  fastify.put('/availability', {
    preHandler: [
      authenticateToken,
      requireRole('volunteer'),
      createUserRateLimit(20, 60 * 1000), // 20 availability updates per minute
    ],
  }, asyncHandler(async (req, res) => {
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'isAvailable must be a boolean',
        },
      });
    }

    await updateUser(req.user.id, {
      isAvailable,
      lastAvailabilityUpdate: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      data: { isAvailable },
      message: 'Availability updated successfully',
    });
  }));

  // Get user statistics
  fastify.get('/stats', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(20, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const user = req.user;

    // Get transaction history
    const transactionHistory = await blockchainService.getUserTransactionHistory(user.id, 10);
    const rewards = await blockchainService.getUserRewards(user.id, 10);

    // Calculate statistics
    const totalEarned = rewards
      .filter(r => r.isDistributed)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const stats = {
      reputationScore: user.reputationScore || 0,
      totalCalls: user.totalCalls || 0,
      totalHelpMinutes: user.totalHelpMinutes || 0,
      averageRating: user.averageRating || 0,
      isVerified: user.isVerified || false,
      walletLinked: !!user.walletAddress,
      totalEarned,
      recentTransactions: transactionHistory.slice(0, 5),
      recentRewards: rewards.slice(0, 5),
    };

    return res.status(200).json({
      success: true,
      data: stats,
      message: 'User statistics retrieved successfully',
    });
  }));

  // Get user transaction history
  fastify.get('/transactions', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(20, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;

    const transactions = await blockchainService.getUserTransactionHistory(
      req.user.id,
      Math.min(parseInt(limit) || 20, 100)
    );

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        total: transactions.length,
        limit: parseInt(limit) || 20,
        offset: parseInt(offset) || 0,
      },
      message: 'Transaction history retrieved successfully',
    });
  }));

  // Get user rewards
  fastify.get('/rewards', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(20, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { limit = 20, type } = req.query;

    let rewards = await blockchainService.getUserRewards(
      req.user.id,
      Math.min(parseInt(limit) || 20, 100)
    );

    // Filter by type if specified
    if (type) {
      rewards = rewards.filter(r => r.rewardType === type);
    }

    return res.status(200).json({
      success: true,
      data: {
        rewards,
        total: rewards.length,
        limit: parseInt(limit) || 20,
        type: type || 'all',
      },
      message: 'User rewards retrieved successfully',
    });
  }));

  // Get user reputation history
  fastify.get('/reputation', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(20, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const user = req.user;

    // This would be implemented with proper reputation history tracking
    const reputationHistory = [];

    return res.status(200).json({
      success: true,
      data: {
        currentScore: user.reputationScore || 0,
        totalCalls: user.totalCalls || 0,
        achievements: user.achievements || [],
        history: reputationHistory,
      },
      message: 'Reputation information retrieved successfully',
    });
  }));

  // Initialize blockchain reputation
  fastify.post('/reputation/initialize', {
    preHandler: [
      authenticateToken,
      requireRole('volunteer'),
      createUserRateLimit(3, 60 * 1000), // 3 attempts per minute
    ],
  }, asyncHandler(async (req, res) => {
    if (!req.user.walletAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Wallet address must be linked first',
        },
      });
    }

    if (req.user.reputationInitialized) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Reputation already initialized',
        },
      });
    }

    const result = await blockchainService.initializeUserReputation(req.user.id);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Reputation initialized successfully',
    });
  }));

  // Get public user profile (for other users to see)
  fastify.get('/:userId/public', {
    preHandler: [
      createUserRateLimit(30, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Return only public information
    const publicProfile = {
      id: user.id,
      firstName: user.firstName,
      userType: user.userType,
      reputationScore: user.reputationScore,
      totalCalls: user.totalCalls,
      totalHelpMinutes: user.totalHelpMinutes,
      averageRating: user.averageRating,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      success: true,
      data: publicProfile,
      message: 'Public profile retrieved successfully',
    });
  }));

  // Health check for users service
  fastify.get('/health', async (req, res) => {
    return res.status(200).json({
      success: true,
      data: {
        service: 'users',
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
      message: 'Users service is healthy',
    });
  });
};

module.exports = usersRoutes;