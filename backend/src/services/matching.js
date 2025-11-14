const { getUser, getActiveVolunteers, createCall, updateCall } = require('../config/database');
const { MatchingError, NotFoundError } = require('../utils/errors');
const config = require('../config/server');
const { logMatchAttempt } = require('../utils/logger');

class MatchingService {
  constructor() {
    this.waitingQueue = new Map(); // userId -> waiting info
    this.activeMatches = new Map(); // roomId -> match info
    this.volunteerLastCall = new Map(); // volunteerId -> last call timestamp
    this.callCount = new Map(); // volunteerId -> total calls today
  }

  // Find best volunteer match for blind user
  async findBestMatch(blindUserId, helpCategory = 'general', priority = 5) {
    try {
      logMatchAttempt(blindUserId, helpCategory, 'searching');

      // Get blind user info
      const blindUser = await getUser(blindUserId);
      if (!blindUser || blindUser.userType !== 'blind') {
        throw new NotFoundError('Blind user');
      }

      // Get available volunteers
      const availableVolunteers = await getActiveVolunteers();

      if (availableVolunteers.length === 0) {
        logMatchAttempt(blindUserId, helpCategory, 'no_volunteers');
        throw new MatchingError('No volunteers available at the moment');
      }

      // Filter and score volunteers
      const scoredVolunteers = availableVolunteers.map(volunteer => {
        const score = this.calculateVolunteerScore(volunteer, helpCategory, priority);
        return { ...volunteer, matchScore: score };
      });

      // Sort by score (highest first)
      scoredVolunteers.sort((a, b) => b.matchScore - a.matchScore);

      // Select best volunteer
      const bestVolunteer = scoredVolunteers[0];

      if (bestVolunteer.matchScore <= 0) {
        logMatchAttempt(blindUserId, helpCategory, 'no_suitable_volunteers');
        throw new MatchingError('No suitable volunteers available');
      }

      logMatchAttempt(blindUserId, helpCategory, `found_${bestVolunteer.id}`);

      return bestVolunteer;
    } catch (error) {
      logMatchAttempt(blindUserId, helpCategory, `error: ${error.message}`);
      throw error;
    }
  }

  // Calculate volunteer match score
  calculateVolunteerScore(volunteer, helpCategory, priority) {
    let score = 0;

    // Base score from reputation
    score += volunteer.reputationScore * config.matching.reputationWeight;

    // Availability boost (volunteers who've been idle longer get priority)
    const lastCallTime = this.volunteerLastCall.get(volunteer.id) || 0;
    const idleTime = Date.now() - lastCallTime;
    const idleHours = idleTime / (1000 * 60 * 60);
    score += Math.min(idleHours * 2, 10); // Max 10 points for idle time

    // Fair distribution (reduce score for volunteers who've had many calls)
    const callCountToday = this.callCount.get(volunteer.id) || 0;
    score -= Math.min(callCountToday * 1, 5); // Max 5 point penalty

    // Skill matching (if volunteer has skills in specified category)
    if (volunteer.skills && volunteer.skills.includes(helpCategory)) {
      score += 10;
    }

    // Response time bonus (if volunteer has fast response history)
    if (volunteer.averageResponseTime && volunteer.averageResponseTime < 30000) { // < 30 seconds
      score += 5;
    }

    // Online status (make sure they're actually online)
    if (!volunteer.isOnline) {
      score -= 20; // Heavy penalty for offline status
    }

    return Math.max(score, 0);
  }

  // Start matching process
  async startMatching(blindUserId, options = {}) {
    const {
      helpCategory = 'general',
      priority = 5,
      timeoutMs = config.matching.maxWaitTime,
    } = options;

    try {
      // Check if user is already in queue
      if (this.waitingQueue.has(blindUserId)) {
        throw new MatchingError('User is already in the matching queue');
      }

      // Add to waiting queue
      const waitingInfo = {
        userId: blindUserId,
        helpCategory,
        priority,
        startTime: Date.now(),
        timeout: Date.now() + timeoutMs,
        status: 'waiting',
      };

      this.waitingQueue.set(blindUserId, waitingInfo);

      logMatchAttempt(blindUserId, helpCategory, 'added_to_queue');

      // Start matching process
      const matchResult = await this.attemptMatch(blindUserId, waitingInfo);

      return matchResult;
    } catch (error) {
      // Clean up queue entry
      this.waitingQueue.delete(blindUserId);
      throw error;
    }
  }

  // Attempt to find a match
  async attemptMatch(blindUserId, waitingInfo) {
    const maxAttempts = 3;
    const attemptDelay = 2000; // 2 seconds between attempts

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check timeout
        if (Date.now() > waitingInfo.timeout) {
          this.waitingQueue.delete(blindUserId);
          throw new MatchingError('Matching timeout - no volunteers found');
        }

        // Find best volunteer
        const volunteer = await this.findBestMatch(
          blindUserId,
          waitingInfo.helpCategory,
          waitingInfo.priority
        );

        // Create call record
        const call = await createCall({
          blindUserId,
          volunteerUserId: volunteer.id,
          helpCategory: waitingInfo.helpCategory,
          status: 'pending',
          startedAt: new Date().toISOString(),
          roomId: this.generateRoomId(),
        });

        // Update volunteer availability
        await this.setVolunteerAvailability(volunteer.id, false);

        // Track the match
        this.activeMatches.set(call.roomId, {
          callId: call.id,
          blindUserId,
          volunteerUserId: volunteer.id,
          roomId: call.roomId,
          status: 'matched',
          matchedAt: Date.now(),
        });

        // Update volunteer statistics
        this.volunteerLastCall.set(volunteer.id, Date.now());
        this.callCount.set(volunteer.id, (this.callCount.get(volunteer.id) || 0) + 1);

        // Remove from waiting queue
        this.waitingQueue.delete(blindUserId);

        logMatchAttempt(blindUserId, waitingInfo.helpCategory, `success: ${volunteer.id}`);

        return {
          success: true,
          volunteer: {
            id: volunteer.id,
            firstName: volunteer.firstName,
            reputationScore: volunteer.reputationScore,
            totalCalls: volunteer.totalCalls,
          },
          call: {
            id: call.id,
            roomId: call.roomId,
            helpCategory: call.helpCategory,
          },
        };

      } catch (error) {
        if (attempt === maxAttempts) {
          this.waitingQueue.delete(blindUserId);
          throw error;
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, attemptDelay));
      }
    }
  }

  // Cancel matching request
  async cancelMatching(blindUserId) {
    try {
      const waitingInfo = this.waitingQueue.get(blindUserId);
      if (!waitingInfo) {
        throw new MatchingError('User is not in the matching queue');
      }

      this.waitingQueue.delete(blindUserId);
      logMatchAttempt(blindUserId, waitingInfo.helpCategory, 'cancelled');

      return { success: true, message: 'Matching request cancelled' };
    } catch (error) {
      throw error;
    }
  }

  // Accept match (from volunteer)
  async acceptMatch(roomId, volunteerId) {
    try {
      const match = this.activeMatches.get(roomId);
      if (!match) {
        throw new NotFoundError('Active match');
      }

      if (match.volunteerUserId !== volunteerId) {
        throw new MatchingError('Volunteer not authorized for this match');
      }

      // Update match status
      match.status = 'accepted';
      match.acceptedAt = Date.now();

      // Update call status
      await updateCall(match.callId, {
        status: 'active',
        startedAt: new Date().toISOString(),
      });

      return {
        success: true,
        roomId: match.roomId,
        blindUserId: match.blindUserId,
        message: 'Match accepted successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  // Decline match (from volunteer)
  async declineMatch(roomId, volunteerId, reason = 'Volunteer unavailable') {
    try {
      const match = this.activeMatches.get(roomId);
      if (!match) {
        throw new NotFoundError('Active match');
      }

      if (match.volunteerUserId !== volunteerId) {
        throw new MatchingError('Volunteer not authorized for this match');
      }

      // Make volunteer available again
      await this.setVolunteerAvailability(volunteerId, true);

      // Update call status
      await updateCall(match.callId, {
        status: 'failed',
        endedAt: new Date().toISOString(),
        feedbackText: reason,
      });

      // Remove from active matches
      this.activeMatches.delete(roomId);

      // Try to find new match for blind user
      const blindUserId = match.blindUserId;
      const waitingInfo = {
        userId: blindUserId,
        helpCategory: 'general', // Default or get from original request
        priority: 5,
        startTime: Date.now(),
        timeout: Date.now() + 60000, // 1 minute for rematch
        status: 'rematching',
      };

      // Start rematching process
      this.attemptMatch(blindUserId, waitingInfo).catch(error => {
        logMatchAttempt(blindUserId, 'rematch', `failed: ${error.message}`);
      });

      return {
        success: true,
        message: 'Match declined and rematch initiated',
      };
    } catch (error) {
      throw error;
    }
  }

  // End call
  async endCall(roomId, endedBy, endReason = 'Call completed normally') {
    try {
      const match = this.activeMatches.get(roomId);
      if (!match) {
        throw new NotFoundError('Active call');
      }

      // Calculate call duration
      const duration = Date.now() - match.matchedAt;

      // Update call status
      await updateCall(match.callId, {
        status: 'completed',
        endedAt: new Date().toISOString(),
        durationSeconds: Math.floor(duration / 1000),
        endReason,
        endedBy,
      });

      // Make volunteer available again
      await this.setVolunteerAvailability(match.volunteerUserId, true);

      // Remove from active matches
      this.activeMatches.delete(roomId);

      return {
        success: true,
        durationSeconds: Math.floor(duration / 1000),
        message: 'Call ended successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  // Set volunteer availability
  async setVolunteerAvailability(volunteerId, isAvailable) {
    try {
      // This would update the database
      // For now, just track in memory
      const volunteer = await getUser(volunteerId);
      if (volunteer) {
        // Update availability in database would go here
        console.log(`Setting volunteer ${volunteerId} availability to: ${isAvailable}`);
      }
    } catch (error) {
      console.error('Error setting volunteer availability:', error);
    }
  }

  // Generate unique room ID
  generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let roomId = '';
    for (let i = 0; i < 12; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
  }

  // Get waiting queue status
  getQueueStatus() {
    const queue = Array.from(this.waitingQueue.values());
    return {
      totalWaiting: queue.length,
      waitingUsers: queue.map(user => ({
        userId: user.userId,
        helpCategory: user.helpCategory,
        waitingTime: Date.now() - user.startTime,
        status: user.status,
      })),
    };
  }

  // Get active matches
  getActiveMatches() {
    return Array.from(this.activeMatches.values());
  }

  // Cleanup expired matches and queue entries
  cleanup() {
    const now = Date.now();

    // Clean up expired queue entries
    for (const [userId, waitingInfo] of this.waitingQueue.entries()) {
      if (now > waitingInfo.timeout) {
        this.waitingQueue.delete(userId);
        logMatchAttempt(userId, waitingInfo.helpCategory, 'timeout');
      }
    }

    // Clean up old matches (older than 24 hours)
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    for (const [roomId, match] of this.activeMatches.entries()) {
      if (match.matchedAt < oneDayAgo) {
        this.activeMatches.delete(roomId);
      }
    }
  }
}

// Start cleanup interval
const matchingService = new MatchingService();
setInterval(() => matchingService.cleanup(), 60000); // Every minute

module.exports = matchingService;