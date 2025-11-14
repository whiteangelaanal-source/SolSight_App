const { authenticateToken, createUserRateLimit } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { asyncHandler } = require('../utils/errors');
const webrtcService = require('../services/webrtc');

const webrtcRoutes = async (fastify) => {
  // WebSocket route for WebRTC signaling
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      // Handle WebSocket connection
      webrtcService.handleConnection(connection, req);
    });
  });

  // Get room information
  fastify.get('/room/:roomId', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(30, 60 * 1000), // 30 requests per minute
    ],
  }, asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const roomInfo = webrtcService.getRoomInfo(roomId);

    if (!roomInfo) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Room not found',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: roomInfo,
      message: 'Room information retrieved successfully',
    });
  }));

  // Get all active rooms (admin/debug endpoint)
  fastify.get('/rooms', {
    preHandler: [
      authenticateToken,
      createUserRateLimit(10, 60 * 1000), // 10 requests per minute
    ],
  }, asyncHandler(async (req, res) => {
    const rooms = webrtcService.getAllRooms();
    return res.status(200).json({
      success: true,
      data: rooms,
      message: 'Active rooms retrieved successfully',
    });
  }));

  // Get WebRTC service statistics
  fastify.get('/stats', {
    preHandler: [
      authenticateToken,
    ],
  }, asyncHandler(async (req, res) => {
    const stats = webrtcService.getStats();
    return res.status(200).json({
      success: true,
      data: stats,
      message: 'WebRTC statistics retrieved successfully',
    });
  }));

  // Health check for WebRTC service
  fastify.get('/health', async (req, res) => {
    const stats = webrtcService.getStats();
    return res.status(200).json({
      success: true,
      data: {
        service: 'webrtc',
        status: 'healthy',
        connections: stats.totalConnections,
        rooms: stats.totalRooms,
        timestamp: new Date().toISOString(),
      },
      message: 'WebRTC service is healthy',
    });
  });

  // STUN/TURN server configuration endpoint
  fastify.get('/ice-servers', async (req, res) => {
    const config = require('../config/server');

    const iceServers = [
      { urls: config.webrtc.stunServer },
    ];

    // Add TURN server if configured
    if (config.webrtc.turnServer) {
      iceServers.push({
        urls: config.webrtc.turnServer,
        username: config.webrtc.turnUsername,
        credential: config.webrtc.turnPassword,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        iceServers,
        maxCallDuration: config.webrtc.maxCallDuration,
        connectionTimeout: config.webrtc.connectionTimeout,
      },
      message: 'ICE server configuration retrieved successfully',
    });
  });
};

module.exports = webrtcRoutes;