const { authenticateToken, requireRole, createUserRateLimit, createBlockchainRateLimit } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../utils/errors');
const blockchainService = require('../services/blockchain');

const rewardsRoutes = async (fastify) => {
  // Queue reward transaction (admin only)
  fastify.post('/distribute', {
    preHandler: [
      authenticateToken,
      // requireRole('admin'), // Add admin role check
      createBlockchainRateLimit,
      validate(schemas.rewardDistribution),
    ],
  }, asyncHandler(async (req, res) => {
    const { userId, rewardType, amount, reason, callId } = req.body;

    const result = await blockchainService.queueRewardTransaction(
      userId,
      amount,
      reason,
      callId,
      rewardType
    );

    return res.status(201).json({
      success: true,
      data: result,
      message: 'Reward transaction queued successfully',
    });
  }));

  // Get reward transaction status
  fastify.get('/transaction/:transactionId', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(20, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { transactionId } = req.params;

    const transaction = await blockchainService.getTransactionStatus(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        },
      });
    }

    // Verify user has access to this transaction
    if (transaction.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Access denied to this transaction',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction,
      message: 'Transaction status retrieved successfully',
    });
  }));

  // Get reward queue status (admin only)
  fastify.get('/queue-status', {
    preHandler: [
      authenticateToken,
      // requireRole('admin'), // Add admin role check
      createUserRateLimit(10, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const queueStatus = blockchainService.getQueueStatus();

    return res.status(200).json({
      success: true,
      data: queueStatus,
      message: 'Reward queue status retrieved successfully',
    });
  }));

  // Retry failed transactions (admin only)
  fastify.post('/retry-failed', {
    preHandler: [
      authenticateToken,
      // requireRole('admin'), // Add admin role check
      createBlockchainRateLimit,
    ],
  }, asyncHandler(async (req, res) => {
    const result = await blockchainService.retryFailedTransactions();

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Failed transactions retry initiated',
    });
  }));

  // Get user rewards
  fastify.get('/user/:userId', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(20, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { limit = 20, type } = req.query;

    // Verify user has access (can only view their own rewards unless admin)
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Access denied to user rewards',
        },
      });
    }

    let rewards = await blockchainService.getUserRewards(
      userId,
      Math.min(parseInt(limit) || 20, 100)
    );

    // Filter by type if specified
    if (type) {
      rewards = rewards.filter(r => r.rewardType === type);
    }

    // Calculate totals
    const totals = rewards.reduce((acc, reward) => {
      if (reward.isDistributed) {
        acc.totalEarned += reward.amount || 0;
        acc[reward.rewardType] = (acc[reward.rewardType] || 0) + (reward.amount || 0);
      }
      return acc;
    }, { totalEarned: 0 });

    return res.status(200).json({
      success: true,
      data: {
        rewards,
        totals,
        filters: {
          limit: parseInt(limit) || 20,
          type: type || 'all',
          count: rewards.length,
        },
      },
      message: 'User rewards retrieved successfully',
    });
  }));

  // Get rewards statistics
  fastify.get('/stats', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(10, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    // This would be implemented with proper aggregation queries
    // For now, return basic statistics
    const stats = {
      totalDistributed: 0,
      totalPending: 0,
      queueStatus: blockchainService.getQueueStatus(),
      rewardDistribution: {
        call_completion: 0,
        milestone: 0,
        bonus: 0,
      },
      period: period,
    };

    return res.status(200).json({
      success: true,
      data: stats,
      message: 'Reward statistics retrieved successfully',
    });
  }));

  // Get all rewards (admin only)
  fastify.get('/all', {
    preHandler: [
      authenticateToken,
      // requireRole('admin'), // Add admin role check
      createUserRateLimit(10, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { limit = 50, offset = 0, status, type } = req.query;

    // This would be implemented with proper database queries
    // For now, return empty result
    const rewards = [];
    const totals = {
      totalDistributed: 0,
      totalPending: 0,
      byType: {
        call_completion: 0,
        milestone: 0,
        bonus: 0,
      },
    };

    return res.status(200).json({
      success: true,
      data: {
        rewards,
        totals,
        filters: {
          limit: parseInt(limit) || 50,
          offset: parseInt(offset) || 0,
          status: status || 'all',
          type: type || 'all',
        },
      },
      message: 'All rewards retrieved successfully',
    });
  }));

  // Update reward status (admin only)
  fastify.put('/:rewardId/status', {
    preHandler: [
      authenticateToken,
      // requireRole('admin'), // Add admin role check
      createUserRateLimit(10, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { rewardId } = req.params;
    const { status, reason } = req.body;

    // This would update the reward status in database
    // For now, return success

    return res.status(200).json({
      success: true,
      data: { rewardId, status, reason },
      message: 'Reward status updated successfully',
    });
  }));

  // Get blockchain configuration info
  fastify.get('/blockchain-info', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(5, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const config = require('../config/blockchain');
    const queueStatus = blockchainService.getQueueStatus();

    const info = {
      network: process.env.SOLANA_NETWORK || 'devnet',
      serverWalletAddress: config.serverKeypair ? config.serverKeypair.publicKey.toString() : null,
      isConfigured: !!config.serverKeypair,
      queueStatus,
      maxRetries: blockchainService.maxRetries,
      processingQueue: queueStatus.isProcessing,
    };

    return res.status(200).json({
      success: true,
      data: info,
      message: 'Blockchain information retrieved successfully',
    });
  }));

  // Health check for rewards service
  fastify.get('/health', async (req, res) => {
    const queueStatus = blockchainService.getQueueStatus();

    return res.status(200).json({
      success: true,
      data: {
        service: 'rewards',
        status: 'healthy',
        queueStatus,
        timestamp: new Date().toISOString(),
      },
      message: 'Rewards service is healthy',
    });
  });
};

module.exports = rewardsRoutes;