const { authenticateToken, requireRole, createUserRateLimit } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../utils/errors');
const { getUser, createCall, updateCall } = require('../config/database');
const blockchainService = require('../services/blockchain');

const callsRoutes = async (fastify) => {
  // Create new call request
  fastify.post('/', {
    preHandler: [
      authenticateToken,
      requireRole('blind'),
      createUserRateLimit(5, 60 * 1000), // 5 call requests per minute
      validate(schemas.createCall),
    ],
  }, asyncHandler(async (req, res) => {
    const { helpCategory, description, volunteerId } = req.body;

    // Create call record
    const call = await createCall({
      blindUserId: req.user.id,
      volunteerUserId: volunteerId || null,
      helpCategory,
      description,
      status: 'pending',
      startedAt: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      data: call,
      message: 'Call request created successfully',
    });
  }));

  // Get call by ID
  fastify.get('/:callId', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(30, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { callId } = req.params;
    const { db } = require('../config/database');

    const callDoc = await db.collection('calls').doc(callId).get();
    if (!callDoc.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Call not found',
        },
      });
    }

    const call = { id: callDoc.id, ...callDoc.data() };

    // Verify user is part of this call
    if (call.blindUserId !== req.user.id && call.volunteerUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Access denied to this call',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: call,
      message: 'Call retrieved successfully',
    });
  }));

  // Update call
  fastify.put('/:callId', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(20, 60 * 1000),
      validate(schemas.updateCall),
    ],
  }, asyncHandler(async (req, res) => {
    const { callId } = req.params;
    const updateData = req.body;

    // Get existing call
    const { db } = require('../config/database');
    const callDoc = await db.collection('calls').doc(callId).get();

    if (!callDoc.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Call not found',
        },
      });
    }

    const existingCall = { id: callDoc.id, ...callDoc.data() };

    // Verify user is part of this call
    if (existingCall.blindUserId !== req.user.id && existingCall.volunteerUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Access denied to this call',
        },
      });
    }

    // Update call
    await updateCall(callId, updateData);

    // Get updated call
    const updatedCallDoc = await db.collection('calls').doc(callId).get();
    const updatedCall = { id: updatedCallDoc.id, ...updatedCallDoc.data() };

    // If call is completed, process rewards
    if (updateData.status === 'completed' && existingCall.volunteerUserId) {
      try {
        const rewards = await blockchainService.processCompletedCall(callId);
        updatedCall.rewards = rewards;
      } catch (error) {
        console.error('Failed to process rewards:', error);
        // Don't fail the request, just log the error
      }
    }

    return res.status(200).json({
      success: true,
      data: updatedCall,
      message: 'Call updated successfully',
    });
  }));

  // End call
  fastify.post('/:callId/end', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(10, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { callId } = req.params;
    const { rating, feedbackText, endReason = 'Call ended by user' } = req.body;

    // Get existing call
    const { db } = require('../config/database');
    const callDoc = await db.collection('calls').doc(callId).get();

    if (!callDoc.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Call not found',
        },
      });
    }

    const existingCall = { id: callDoc.id, ...callDoc.data() };

    // Verify user is part of this call
    if (existingCall.blindUserId !== req.user.id && existingCall.volunteerUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Access denied to this call',
        },
      });
    }

    // Only blind users can rate volunteers
    if (rating && req.user.userType !== 'blind') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Only blind users can rate calls',
        },
      });
    }

    // Calculate duration
    const startedAt = new Date(existingCall.startedAt);
    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt - startedAt) / 1000);

    // Update call
    const updateData = {
      status: 'completed',
      endedAt: endedAt.toISOString(),
      durationSeconds,
      endReason,
      endedBy: req.user.id,
    };

    if (rating && req.user.userType === 'blind') {
      updateData.rating = rating;
    }

    if (feedbackText) {
      updateData.feedbackText = feedbackText;
    }

    await updateCall(callId, updateData);

    // Get updated call
    const updatedCallDoc = await db.collection('calls').doc(callId).get();
    const updatedCall = { id: updatedCallDoc.id, ...updatedCallDoc.data() };

    // Process rewards for completed volunteer calls
    if (existingCall.volunteerUserId && existingCall.status !== 'completed') {
      try {
        const rewards = await blockchainService.processCompletedCall(callId);
        updatedCall.rewards = rewards;

        // Update volunteer reputation based on rating
        if (rating && req.user.userType === 'blind') {
          const volunteer = await getUser(existingCall.volunteerUserId);
          if (volunteer) {
            let reputationChange = 10; // Base for completion

            // Bonus for good ratings
            if (rating >= 4) {
              reputationChange += (rating - 3) * 5;
            }

            // Penalty for poor ratings
            if (rating <= 2) {
              reputationChange -= (3 - rating) * 5;
            }

            const newReputation = Math.max(0, (volunteer.reputationScore || 0) + reputationChange);
            await blockchainService.updateUserReputation(
              volunteer.id,
              newReputation,
              `Call ${callId} rated ${rating} stars`
            );
          }
        }
      } catch (error) {
        console.error('Failed to process rewards:', error);
        // Don't fail the request, just log the error
      }
    }

    return res.status(200).json({
      success: true,
      data: updatedCall,
      message: 'Call ended successfully',
    });
  }));

  // Get user's call history
  fastify.get('/history', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(20, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0, status, userType } = req.query;

    const { db } = require('../config/database');
    let query = db.collection('calls');

    // Filter by user
    if (userType === 'blind' || req.user.userType === 'blind') {
      query = query.where('blindUserId', '==', req.user.id);
    } else {
      query = query.where('volunteerUserId', '==', req.user.id);
    }

    // Filter by status if specified
    if (status) {
      query = query.where('status', '==', status);
    }

    // Order by creation date (newest first)
    query = query.orderBy('createdAt', 'desc');

    // Apply limit and offset
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = parseInt(offset) || 0;

    const snapshot = await query.limit(limitNum).offset(offsetNum).get();
    const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get total count (approximate for Firestore)
    const countSnapshot = await query.limit(1).get();
    const hasMore = calls.length === limitNum;

    return res.status(200).json({
      success: true,
      data: {
        calls,
        hasMore,
        limit: limitNum,
        offset: offsetNum,
      },
      message: 'Call history retrieved successfully',
    });
  }));

  // Get active calls for volunteers
  fastify.get('/active', {
    preHandler: [
      authenticateToken,
      requireRole('volunteer'),
      createUserRateLimit(10, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const { db } = require('../config/database');
    const query = await db.collection('calls')
      .where('status', 'in', ['pending', 'active'])
      .where('volunteerUserId', '==', null)
      .orderBy('createdAt', 'asc')
      .limit(parseInt(limit) || 10)
      .get();

    const activeCalls = query.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Remove sensitive information about blind users
    const sanitizedCalls = activeCalls.map(call => ({
      ...call,
      blindUserId: undefined, // Remove blind user ID for privacy
    }));

    return res.status(200).json({
      success: true,
      data: sanitizedCalls,
      message: 'Active calls retrieved successfully',
    });
  }));

  // Get call statistics
  fastify.get('/stats', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(10, 60 * 1000),
    ],
  }, asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    const { db } = require('../config/database');

    // Calculate date range
    const days = parseInt(period.replace('d', '')) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query;
    if (req.user.userType === 'blind') {
      query = db.collection('calls')
        .where('blindUserId', '==', req.user.id)
        .where('createdAt', '>=', startDate);
    } else {
      query = db.collection('calls')
        .where('volunteerUserId', '==', req.user.id)
        .where('createdAt', '>=', startDate);
    }

    const snapshot = await query.get();
    const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate statistics
    const stats = {
      totalCalls: calls.length,
      completedCalls: calls.filter(c => c.status === 'completed').length,
      cancelledCalls: calls.filter(c => c.status === 'failed').length,
      averageDuration: calls
        .filter(c => c.durationSeconds)
        .reduce((sum, c) => sum + c.durationSeconds, 0) / calls.filter(c => c.durationSeconds).length || 0,
      totalMinutes: calls
        .filter(c => c.durationSeconds)
        .reduce((sum, c) => sum + Math.ceil(c.durationSeconds / 60), 0),
      averageRating: calls
        .filter(c => c.rating)
        .reduce((sum, c) => sum + c.rating, 0) / calls.filter(c => c.rating).length || 0,
      byCategory: calls.reduce((acc, c) => {
        acc[c.helpCategory || 'general'] = (acc[c.helpCategory || 'general'] || 0) + 1;
        return acc;
      }, {}),
    };

    return res.status(200).json({
      success: true,
      data: stats,
      message: 'Call statistics retrieved successfully',
    });
  }));

  // Health check for calls service
  fastify.get('/health', async (req, res) => {
    return res.status(200).json({
      success: true,
      data: {
        service: 'calls',
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
      message: 'Calls service is healthy',
    });
  });
};

module.exports = callsRoutes;