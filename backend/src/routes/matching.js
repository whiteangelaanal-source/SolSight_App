const { authenticateToken, requireRole, createUserRateLimit, createMatchingRateLimit } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../utils/errors');
const matchingService = require('../services/matching');

const matchingRoutes = async (fastify) => {
  // Start matching process
  fastify.post('/start', {
    preHandler: [
      authenticateToken,
      requireRole('blind'),
      createMatchingRateLimit,
      validate(schemas.matchingRequest),
    ],
  }, asyncHandler(async (req, res) => {
    const { helpCategory, priority, timeoutMs } = req.body;
    const result = await matchingService.startMatching(req.user.id, {
      helpCategory,
      priority,
      timeoutMs,
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: result.success ? 'Volunteer found successfully' : 'Matching process started',
    });
  }));

  // Cancel matching request
  fastify.post('/cancel', {
    preHandler: [
      authenticateToken,
      requireRole('blind'),
      createMatchingRateLimit,
    ],
  }, asyncHandler(async (req, res) => {
    const result = await matchingService.cancelMatching(req.user.id);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Matching request cancelled',
    });
  }));

  // Accept match
  fastify.post('/accept/:roomId', {
    preHandler: [
      authenticateToken,
      requireRole('volunteer'),
      createMatchingRateLimit,
    ],
  }, asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const result = await matchingService.acceptMatch(roomId, req.user.id);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Match accepted successfully',
    });
  }));

  // Decline match
  fastify.post('/decline/:roomId', {
    preHandler: [
      authenticateToken,
      requireRole('volunteer'),
      createMatchingRateLimit,
    ],
  }, asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const { reason } = req.body;
    const result = await matchingService.declineMatch(roomId, req.user.id, reason);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Match declined successfully',
    });
  }));

  // End call
  fastify.post('/end/:roomId', {
    preHandler: [
      authenticateToken,
      createMatchingRateLimit,
    ],
  }, asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const { endReason } = req.body;
    const result = await matchingService.endCall(roomId, req.user.id, endReason);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Call ended successfully',
    });
  }));

  // Get queue status (for volunteers to see demand)
  fastify.get('/queue-status', {
    preHandler: [
      authenticateToken,
      requireRole('volunteer'),
    ],
  }, asyncHandler(async (req, res) => {
    const queueStatus = matchingService.getQueueStatus();
    return res.status(200).json({
      success: true,
      data: queueStatus,
      message: 'Queue status retrieved successfully',
    });
  }));

  // Get active matches (for admin use)
  fastify.get('/active-matches', {
    preHandler: [
      authenticateToken,
      // Add admin check if needed
    ],
  }, asyncHandler(async (req, res) => {
    const activeMatches = matchingService.getActiveMatches();
    return res.status(200).json({
      success: true,
      data: activeMatches,
      message: 'Active matches retrieved successfully',
    });
  }));

  // Get matching statistics
  fastify.get('/stats', {
    preHandler: [
      authenticateToken,
    ],
  }, asyncHandler(async (req, res) => {
    const queueStatus = matchingService.getQueueStatus();
    const activeMatches = matchingService.getActiveMatches();

    const stats = {
      queueStatus,
      activeMatches: activeMatches.length,
      totalWaiting: queueStatus.totalWaiting,
      averageWaitTime: queueStatus.waitingUsers.length > 0
        ? queueStatus.waitingUsers.reduce((sum, user) => sum + user.waitingTime, 0) / queueStatus.waitingUsers.length
        : 0,
      categoryDistribution: queueStatus.waitingUsers.reduce((acc, user) => {
        acc[user.helpCategory] = (acc[user.helpCategory] || 0) + 1;
        return acc;
      }, {}),
    };

    return res.status(200).json({
      success: true,
      data: stats,
      message: 'Matching statistics retrieved successfully',
    });
  }));

  // Health check for matching service
  fastify.get('/health', async (req, res) => {
    const stats = matchingService.getQueueStatus();
    return res.status(200).json({
      success: true,
      data: {
        service: 'matching',
        status: 'healthy',
        queueStatus: stats,
        timestamp: new Date().toISOString(),
      },
      message: 'Matching service is healthy',
    });
  });
};

module.exports = matchingRoutes;