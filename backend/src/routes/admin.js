const { requireAdmin, logAdminAction, validateAdminAction } = require('../middleware/adminAuth');
const { getUser, updateUser, getUsers, getCallHistory, getActiveCalls } = require('../config/database');
const { logger } = require('../utils/logger');
const { AuthorizationError, ValidationError } = require('../utils/errors');

// Admin routes
const adminRoutes = async (fastify) => {
  // GET /api/admin/users - List all users with pagination and filters
  fastify.get('/users', {
    preHandler: [...requireAdmin, logAdminAction('user_list')]
  }, async (request, reply) => {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        status,
        dateFrom,
        dateTo,
        search
      } = request.query;

      const offset = (page - 1) * limit;

      // Build query filters
      const filters = {};
      if (role) filters.userType = role;
      if (status) filters.status = status;
      if (dateFrom) filters.dateFrom = new Date(dateFrom);
      if (dateTo) filters.dateTo = new Date(dateTo);
      if (search) filters.search = search;

      const users = await getUsers(filters, limit, offset);
      const total = await getUsers(filters, 0, 0, true); // count only

      return {
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        },
        message: 'Users retrieved successfully'
      };
    } catch (error) {
      logger.error('Error getting admin users:', error);
      throw error;
    }
  });

  // GET /api/admin/users/:id - Get detailed user information
  fastify.get('/users/:id', {
    preHandler: [...requireAdmin, logAdminAction('user_view')]
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const user = await getUser(id);
      if (!user) {
        return reply.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      // Get additional user data
      const [callHistory, userStats] = await Promise.all([
        getCallHistory({ userId: id }, 50, 0),
        getUserStats(id)
      ]);

      return {
        success: true,
        data: {
          user,
          callHistory,
          stats: userStats
        },
        message: 'User details retrieved successfully'
      };
    } catch (error) {
      logger.error('Error getting admin user details:', error);
      throw error;
    }
  });

  // POST /api/admin/users/:id/ban - Ban user
  fastify.post('/users/:id/ban', {
    preHandler: [...requireAdmin, logAdminAction('user_ban'), validateAdminAction('user_management')]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { reason, duration, notifyUser = true } = request.body;

      if (!reason) {
        throw new ValidationError('Ban reason is required');
      }

      const user = await getUser(id);
      if (!user) {
        return reply.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      if (user.userType === 'admin') {
        throw new AuthorizationError('Cannot ban admin users');
      }

      // Update user to banned status
      const banUntil = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;
      await updateUser(id, {
        isActive: false,
        banned: true,
        banReason: reason,
        banUntil,
        bannedAt: new Date(),
        bannedBy: request.user.id
      });

      logger.warn('User banned', {
        userId: id,
        bannedBy: request.user.id,
        reason,
        duration,
        banUntil
      });

      // TODO: Send notification email to user if notifyUser is true

      return {
        success: true,
        data: {
          userId: id,
          banned: true,
          banReason: reason,
          banUntil,
          bannedAt: new Date()
        },
        message: 'User banned successfully'
      };
    } catch (error) {
      logger.error('Error banning user:', error);
      throw error;
    }
  });

  // POST /api/admin/users/:id/unban - Unban user
  fastify.post('/users/:id/unban', {
    preHandler: [...requireAdmin, logAdminAction('user_unban'), validateAdminAction('user_management')]
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const user = await getUser(id);
      if (!user) {
        return reply.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      await updateUser(id, {
        isActive: true,
        banned: false,
        banReason: null,
        banUntil: null,
        unbannedAt: new Date(),
        unbannedBy: request.user.id
      });

      logger.info('User unbanned', {
        userId: id,
        unbannedBy: request.user.id
      });

      return {
        success: true,
        data: {
          userId: id,
          unbanned: true,
          unbannedAt: new Date()
        },
        message: 'User unbanned successfully'
      };
    } catch (error) {
      logger.error('Error unbanning user:', error);
      throw error;
    }
  });

  // GET /api/admin/analytics - Platform statistics and analytics
  fastify.get('/analytics', {
    preHandler: [...requireAdmin, logAdminAction('analytics_view'), validateAdminAction('system_analytics')]
  }, async (request, reply) => {
    try {
      const { period = '30d', metric } = request.query;

      // Get platform statistics
      const [
        userStats,
        callStats,
        rewardStats,
        geographicStats,
        deviceStats
      ] = await Promise.all([
        getUserAnalytics(period),
        getCallAnalytics(period),
        getRewardAnalytics(period),
        getGeographicDistribution(),
        getDeviceUsageStats()
      ]);

      return {
        success: true,
        data: {
          period,
          users: userStats,
          calls: callStats,
          rewards: rewardStats,
          geographic: geographicStats,
          devices: deviceStats
        },
        message: 'Analytics retrieved successfully'
      };
    } catch (error) {
      logger.error('Error getting admin analytics:', error);
      throw error;
    }
  });

  // GET /api/admin/system/health - System health metrics
  fastify.get('/system/health', {
    preHandler: [...requireAdmin, logAdminAction('system_health'), validateAdminAction('system_health')]
  }, async (request, reply) => {
    try {
      const [
        databaseHealth,
        websocketHealth,
        blockchainHealth,
        systemMetrics
      ] = await Promise.all([
        checkDatabaseHealth(),
        checkWebSocketHealth(),
        checkBlockchainHealth(),
        getSystemMetrics()
      ]);

      const overallHealth = databaseHealth.status === 'healthy' &&
                         websocketHealth.status === 'healthy' &&
                         blockchainHealth.status === 'healthy';

      return {
        success: true,
        data: {
          overall: overallHealth ? 'healthy' : 'degraded',
          database: databaseHealth,
          websocket: websocketHealth,
          blockchain: blockchainHealth,
          system: systemMetrics,
          timestamp: new Date().toISOString()
        },
        message: 'System health retrieved successfully'
      };
    } catch (error) {
      logger.error('Error getting system health:', error);
      throw error;
    }
  });

  // GET /api/admin/calls - Call history with filters
  fastify.get('/calls', {
    preHandler: [...requireAdmin, logAdminAction('call_history'), validateAdminAction('call_management')]
  }, async (request, reply) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        dateFrom,
        dateTo,
        userId
      } = request.query;

      const offset = (page - 1) * limit;

      const filters = {};
      if (status) filters.status = status;
      if (dateFrom) filters.dateFrom = new Date(dateFrom);
      if (dateTo) filters.dateTo = new Date(dateTo);
      if (userId) filters.userId = userId;

      const calls = await getCallHistory(filters, limit, offset);
      const total = await getCallHistory(filters, 0, 0, true);

      return {
        success: true,
        data: {
          calls,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        },
        message: 'Call history retrieved successfully'
      };
    } catch (error) {
      logger.error('Error getting admin call history:', error);
      throw error;
    }
  });
};

// Helper functions for analytics
async function getUserAnalytics(period) {
  // This would query the database for user statistics
  // For now, return mock data structure
  return {
    total: 1000,
    active: 750,
    newThisPeriod: 150,
    byType: {
      blind: 600,
      volunteer: 400,
      admin: 10
    },
    retentionRate: 85.5
  };
}

async function getCallAnalytics(period) {
  // Mock implementation
  return {
    total: 5000,
    completed: 4800,
    averageDuration: 12.5, // minutes
    successRate: 96.0,
    dailyBreakdown: [
      { date: '2024-01-01', calls: 45 },
      { date: '2024-01-02', calls: 52 },
      // ... more data points
    ]
  };
}

async function getRewardAnalytics(period) {
  // Mock implementation
  return {
    totalDistributed: 150.75,
    transactions: 1200,
    averageReward: 0.125,
    byType: {
      milestone: 75.5,
      airdrop: 50.0,
      bonus: 25.25
    }
  };
}

async function getGeographicDistribution() {
  // Mock implementation
  return {
    countries: [
      { country: 'United States', users: 450, percentage: 45.0 },
      { country: 'United Kingdom', users: 180, percentage: 18.0 },
      { country: 'Canada', users: 120, percentage: 12.0 },
      { country: 'Australia', users: 90, percentage: 9.0 },
      { country: 'Other', users: 160, percentage: 16.0 }
    ]
  };
}

async function getDeviceUsageStats() {
  // Mock implementation
  return {
    platforms: [
      { platform: 'Android', users: 550, percentage: 55.0 },
      { platform: 'iOS', users: 450, percentage: 45.0 }
    ]
  };
}

async function checkDatabaseHealth() {
  // Mock implementation - would check actual DB connection
  return {
    status: 'healthy',
    responseTime: 12, // ms
    connections: 25,
    lastCheck: new Date().toISOString()
  };
}

async function checkWebSocketHealth() {
  // Mock implementation
  return {
    status: 'healthy',
    activeConnections: 45,
    maxConnections: 1000,
    lastCheck: new Date().toISOString()
  };
}

async function checkBlockchainHealth() {
  // Mock implementation
  return {
    status: 'healthy',
    network: 'mainnet-beta',
    blockHeight: 123456,
    lastCheck: new Date().toISOString()
  };
}

async function getSystemMetrics() {
  // Mock implementation
  return {
    cpuUsage: 45.2,
    memoryUsage: 68.7,
    diskUsage: 32.1,
    uptime: 86400, // seconds
    responseTime: 125 // average API response time in ms
  };
}

async function getUserStats(userId) {
  // Mock implementation
  return {
    totalCalls: 25,
    averageRating: 4.7,
    reliabilityScore: 92,
    totalRewards: 3.25
  };
}

module.exports = adminRoutes;