const { WebSocket } = require('@fastify/websocket');
const { getActiveVolunteers, updateCall } = require('../config/database');
const { WebRTCError, NotFoundError } = require('../utils/errors');
const config = require('../config/server');
const { logWebSocketEvent } = require('../utils/logger');

class WebRTCService {
  constructor() {
    this.rooms = new Map(); // roomId -> room info
    this.connections = new Map(); // connectionId -> connection info
    this.connectionCounter = 0;
  }

  // Handle WebSocket connection
  handleConnection(connection, req) {
    const connectionId = ++this.connectionCounter;

    const connectionInfo = {
      id: connectionId,
      connection,
      userId: null,
      userType: null,
      roomId: null,
      connectedAt: Date.now(),
      isAlive: true,
    };

    this.connections.set(connectionId, connectionInfo);

    logWebSocketEvent('connected', { connectionId }, null);

    // Setup message handlers
    connection.socket.on('message', (message) => {
      this.handleMessage(connectionId, message);
    });

    // Setup connection monitoring
    connection.socket.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    connection.socket.on('error', (error) => {
      logWebSocketEvent('error', { error: error.message, connectionId }, null);
    });

    // Heartbeat mechanism
    connection.socket.on('pong', () => {
      connectionInfo.isAlive = true;
    });

    // Start heartbeat interval
    const heartbeatInterval = setInterval(() => {
      if (!connectionInfo.isAlive) {
        connection.socket.terminate();
        clearInterval(heartbeatInterval);
        return;
      }

      connectionInfo.isAlive = false;
      connection.socket.ping();
    }, 30000); // 30 seconds

    // Store interval for cleanup
    connectionInfo.heartbeatInterval = heartbeatInterval;

    // Send welcome message
    this.sendMessage(connectionId, {
      type: 'connected',
      data: {
        connectionId,
        serverTime: Date.now(),
      },
    });
  }

  // Handle incoming messages
  async handleMessage(connectionId, message) {
    try {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo) {
        return;
      }

      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message.toString());
      } catch (error) {
        this.sendError(connectionId, 'Invalid JSON message format');
        return;
      }

      const { type, data } = parsedMessage;

      logWebSocketEvent('message_received', { type, data }, connectionInfo.userId);

      switch (type) {
        case 'join_room':
          await this.handleJoinRoom(connectionId, data);
          break;

        case 'leave_room':
          await this.handleLeaveRoom(connectionId);
          break;

        case 'offer':
          await this.handleOffer(connectionId, data);
          break;

        case 'answer':
          await this.handleAnswer(connectionId, data);
          break;

        case 'ice_candidate':
          await this.handleIceCandidate(connectionId, data);
          break;

        case 'call_status':
          await this.handleCallStatus(connectionId, data);
          break;

        case 'ping':
          this.sendMessage(connectionId, { type: 'pong', data: { timestamp: Date.now() } });
          break;

        default:
          this.sendError(connectionId, `Unknown message type: ${type}`);
      }
    } catch (error) {
      logWebSocketEvent('message_error', { error: error.message }, connectionId);
      this.sendError(connectionId, `Error processing message: ${error.message}`);
    }
  }

  // Handle join room request
  async handleJoinRoom(connectionId, data) {
    try {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo) {
        throw new NotFoundError('Connection');
      }

      const { roomId, userId, userType } = data;

      if (!roomId || !userId || !userType) {
        throw new WebRTCError('Missing required fields: roomId, userId, userType');
      }

      if (!['blind', 'volunteer'].includes(userType)) {
        throw new WebRTCError('Invalid user type');
      }

      // Leave existing room if any
      if (connectionInfo.roomId) {
        await this.handleLeaveRoom(connectionId);
      }

      // Get or create room
      let room = this.rooms.get(roomId);
      if (!room) {
        room = {
          id: roomId,
          participants: new Map(),
          createdAt: Date.now(),
          status: 'waiting',
        };
        this.rooms.set(roomId, room);
      }

      // Add user to room
      const participant = {
        connectionId,
        userId,
        userType,
        joinedAt: Date.now(),
        isReady: false,
      };

      room.participants.set(userId, participant);

      // Update connection info
      connectionInfo.userId = userId;
      connectionInfo.userType = userType;
      connectionInfo.roomId = roomId;

      // Update room status
      if (room.participants.size === 2) {
        room.status = 'ready';
      }

      logWebSocketEvent('room_joined', { roomId, userId, userType }, userId);

      // Notify room participants
      this.broadcastToRoom(roomId, {
        type: 'user_joined',
        data: {
          userId,
          userType,
          roomStatus: room.status,
          participants: Array.from(room.participants.values()).map(p => ({
            userId: p.userId,
            userType: p.userType,
            joinedAt: p.joinedAt,
            isReady: p.isReady,
          })),
        },
      }, connectionId);

      // Send confirmation to joining user
      this.sendMessage(connectionId, {
        type: 'room_joined',
        data: {
          roomId,
          roomStatus: room.status,
          participants: Array.from(room.participants.values()).map(p => ({
            userId: p.userId,
            userType: p.userType,
            joinedAt: p.joinedAt,
            isReady: p.isReady,
          })),
        },
      });

    } catch (error) {
      this.sendError(connectionId, `Failed to join room: ${error.message}`);
    }
  }

  // Handle leave room request
  async handleLeaveRoom(connectionId) {
    try {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo || !connectionInfo.roomId) {
        return;
      }

      const { roomId, userId } = connectionInfo;
      const room = this.rooms.get(roomId);

      if (room) {
        // Remove participant
        room.participants.delete(userId);

        // Notify other participants
        this.broadcastToRoom(roomId, {
          type: 'user_left',
          data: {
            userId,
            remainingParticipants: room.participants.size,
          },
        }, connectionId);

        // Clean up empty rooms
        if (room.participants.size === 0) {
          this.rooms.delete(roomId);
          logWebSocketEvent('room_deleted', { roomId }, userId);
        } else {
          room.status = 'waiting';
        }
      }

      // Clear connection room info
      connectionInfo.roomId = null;

      logWebSocketEvent('room_left', { roomId }, userId);

      // Send confirmation
      this.sendMessage(connectionId, {
        type: 'room_left',
        data: { roomId },
      });

    } catch (error) {
      this.sendError(connectionId, `Failed to leave room: ${error.message}`);
    }
  }

  // Handle WebRTC offer
  async handleOffer(connectionId, data) {
    try {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo || !connectionInfo.roomId) {
        throw new WebRTCError('Not in a room');
      }

      const { offer, targetUserId } = data;

      if (!offer || !targetUserId) {
        throw new WebRTCError('Missing offer or targetUserId');
      }

      // Find target participant
      const room = this.rooms.get(connectionInfo.roomId);
      const targetParticipant = room.participants.get(targetUserId);

      if (!targetParticipant) {
        throw new NotFoundError('Target user in room');
      }

      // Forward offer to target
      this.sendMessage(targetParticipant.connectionId, {
        type: 'offer',
        data: {
          offer,
          fromUserId: connectionInfo.userId,
          fromUserType: connectionInfo.userType,
        },
      });

      logWebSocketEvent('offer_sent', { fromUserId: connectionInfo.userId, targetUserId }, connectionInfo.userId);

    } catch (error) {
      this.sendError(connectionId, `Failed to send offer: ${error.message}`);
    }
  }

  // Handle WebRTC answer
  async handleAnswer(connectionId, data) {
    try {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo || !connectionInfo.roomId) {
        throw new WebRTCError('Not in a room');
      }

      const { answer, targetUserId } = data;

      if (!answer || !targetUserId) {
        throw new WebRTCError('Missing answer or targetUserId');
      }

      // Find target participant
      const room = this.rooms.get(connectionInfo.roomId);
      const targetParticipant = room.participants.get(targetUserId);

      if (!targetParticipant) {
        throw new NotFoundError('Target user in room');
      }

      // Forward answer to target
      this.sendMessage(targetParticipant.connectionId, {
        type: 'answer',
        data: {
          answer,
          fromUserId: connectionInfo.userId,
          fromUserType: connectionInfo.userType,
        },
      });

      logWebSocketEvent('answer_sent', { fromUserId: connectionInfo.userId, targetUserId }, connectionInfo.userId);

    } catch (error) {
      this.sendError(connectionId, `Failed to send answer: ${error.message}`);
    }
  }

  // Handle ICE candidate
  async handleIceCandidate(connectionId, data) {
    try {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo || !connectionInfo.roomId) {
        throw new WebRTCError('Not in a room');
      }

      const { candidate, targetUserId } = data;

      if (!candidate || !targetUserId) {
        throw new WebRTCError('Missing ICE candidate or targetUserId');
      }

      // Find target participant
      const room = this.rooms.get(connectionInfo.roomId);
      const targetParticipant = room.participants.get(targetUserId);

      if (!targetParticipant) {
        throw new NotFoundError('Target user in room');
      }

      // Forward ICE candidate to target
      this.sendMessage(targetParticipant.connectionId, {
        type: 'ice_candidate',
        data: {
          candidate,
          fromUserId: connectionInfo.userId,
        },
      });

      logWebSocketEvent('ice_candidate_sent', { fromUserId: connectionInfo.userId, targetUserId }, connectionInfo.userId);

    } catch (error) {
      this.sendError(connectionId, `Failed to send ICE candidate: ${error.message}`);
    }
  }

  // Handle call status updates
  async handleCallStatus(connectionId, data) {
    try {
      const connectionInfo = this.connections.get(connectionId);
      if (!connectionInfo || !connectionInfo.roomId) {
        throw new WebRTCError('Not in a room');
      }

      const { status, reason } = data;

      if (!status) {
        throw new WebRTCError('Missing status');
      }

      const room = this.rooms.get(connectionInfo.roomId);

      // Update room status
      room.status = status;

      // Update database if call ended
      if (['completed', 'failed', 'ended'].includes(status)) {
        try {
          await updateCall(room.callId, {
            status: status === 'completed' ? 'completed' : 'failed',
            endedAt: new Date().toISOString(),
            feedbackText: reason || 'Call ended via WebRTC',
          });
        } catch (error) {
          logWebSocketEvent('database_error', { error: error.message }, connectionInfo.userId);
        }
      }

      // Broadcast status to room
      this.broadcastToRoom(connectionInfo.roomId, {
        type: 'call_status',
        data: {
          status,
          reason,
          updatedBy: connectionInfo.userId,
        },
      }, connectionId);

      logWebSocketEvent('call_status_updated', { status, reason }, connectionInfo.userId);

    } catch (error) {
      this.sendError(connectionId, `Failed to update call status: ${error.message}`);
    }
  }

  // Send message to specific connection
  sendMessage(connectionId, message) {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo || connectionInfo.connection.socket.readyState !== 1) {
      return false;
    }

    try {
      connectionInfo.connection.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logWebSocketEvent('send_error', { error: error.message }, connectionInfo.userId);
      return false;
    }
  }

  // Send error message to connection
  sendError(connectionId, error) {
    this.sendMessage(connectionId, {
      type: 'error',
      data: {
        error,
        timestamp: Date.now(),
      },
    });
  }

  // Broadcast message to room (excluding specific connection)
  broadcastToRoom(roomId, message, excludeConnectionId = null) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    room.participants.forEach((participant) => {
      if (participant.connectionId !== excludeConnectionId) {
        this.sendMessage(participant.connectionId, message);
      }
    });
  }

  // Handle disconnection
  handleDisconnection(connectionId) {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) {
      return;
    }

    const { userId, userType, roomId, heartbeatInterval } = connectionInfo;

    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Handle room cleanup
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.participants.delete(userId);

        // Notify other participants
        this.broadcastToRoom(roomId, {
          type: 'user_disconnected',
          data: {
            userId,
            userType,
            reason: 'Connection lost',
          },
        }, connectionId);

        // Clean up empty rooms
        if (room.participants.size === 0) {
          this.rooms.delete(roomId);
        } else {
          room.status = 'waiting';
        }
      }

      // Update database if user was in active call
      if (room && ['active', 'connected'].includes(room.status)) {
        updateCall(room.callId, {
          status: 'failed',
          endedAt: new Date().toISOString(),
          feedbackText: `User ${userId} disconnected`,
        }).catch(error => {
          logWebSocketEvent('database_error', { error: error.message }, userId);
        });
      }
    }

    // Remove connection
    this.connections.delete(connectionId);

    logWebSocketEvent('disconnected', { userId, roomId }, userId);
  }

  // Get room information
  getRoomInfo(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return {
      id: room.id,
      status: room.status,
      participantCount: room.participants.size,
      participants: Array.from(room.participants.values()).map(p => ({
        userId: p.userId,
        userType: p.userType,
        joinedAt: p.joinedAt,
        isReady: p.isReady,
      })),
      createdAt: room.createdAt,
    };
  }

  // Get all active rooms
  getAllRooms() {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      status: room.status,
      participantCount: room.participants.size,
      createdAt: room.createdAt,
    }));
  }

  // Get connection statistics
  getStats() {
    return {
      totalConnections: this.connections.size,
      totalRooms: this.rooms.size,
      connectionsByType: Array.from(this.connections.values()).reduce((acc, conn) => {
        if (conn.userType) {
          acc[conn.userType] = (acc[conn.userType] || 0) + 1;
        }
        return acc;
      }, {}),
    };
  }

  // Cleanup inactive connections
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, connectionInfo] of this.connections.entries()) {
      if (now - connectionInfo.connectedAt > maxAge && !connectionInfo.isAlive) {
        connectionInfo.connection.socket.terminate();
        this.connections.delete(connectionId);
        logWebSocketEvent('cleanup', { connectionId }, connectionInfo.userId);
      }
    }

    // Clean up old rooms (older than 1 hour with no participants)
    const oneHourAgo = now - (60 * 60 * 1000);
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.participants.size === 0 && room.createdAt < oneHourAgo) {
        this.rooms.delete(roomId);
        logWebSocketEvent('room_cleanup', { roomId }, null);
      }
    }
  }
}

// Start cleanup interval
const webrtcService = new WebRTCService();
setInterval(() => webrtcService.cleanup(), 60000); // Every minute

module.exports = webrtcService;