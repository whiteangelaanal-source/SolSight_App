const { expect } = require('chai');
const request = require('supertest');
const WebSocket = require('ws');
const { setupTestDatabase, cleanupTestDatabase, setupRedis, stopRedis } = require('../setup');

const app = require('../../src/app');

describe('API Integration Tests', () => {
  let blindUser, volunteerUser;
  let blindToken, volunteerToken;

  before(async () => {
    await setupTestDatabase();
    await setupRedis();

    // Create test users
    const blindResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Blind Test User',
        email: 'blind@example.com',
        password: 'password123',
        userType: 'blind',
        location: 'New York, USA'
      });

    const volunteerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Volunteer Test User',
        email: 'volunteer@example.com',
        password: 'password123',
        userType: 'volunteer',
        location: 'New York, USA'
      });

    blindUser = blindResponse.body.data.user;
    volunteerUser = volunteerResponse.body.data.user;
    blindToken = blindResponse.body.data.accessToken;
    volunteerToken = volunteerResponse.body.data.accessToken;

    // Set volunteer as available
    await request(app)
      .put('/api/users/availability')
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ isAvailable: true });
  });

  after(async () => {
    await cleanupTestDatabase();
    await stopRedis();
  });

  describe('Complete User Journey', () => {
    it('should complete blind user journey from signup to call', async () => {
      // 1. User signup (already done in setup)
      expect(blindUser).to.be.an('object');
      expect(blindToken).to.be.a('string');

      // 2. Get user profile
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${blindToken}`);

      expect(profileResponse.status).to.equal(200);
      expect(profileResponse.body.data.user.email).to.equal('blind@example.com');

      // 3. Update user profile
      const updateResponse = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${blindToken}`)
        .send({
          preferences: {
            language: 'english',
            assistanceType: 'mobility'
          }
        });

      expect(updateResponse.status).to.equal(200);
      expect(updateResponse.body.data.user.preferences.language).to.equal('english');

      // 4. Start matching
      const matchResponse = await request(app)
        .post('/api/matching/start')
        .set('Authorization', `Bearer ${blindToken}`)
        .send({});

      expect(matchResponse.status).to.equal(200);
      expect(matchResponse.body.data).to.have.property('roomId');

      // 5. Get queue status
      const statusResponse = await request(app)
        .get('/api/matching/queue-status')
        .set('Authorization', `Bearer ${blindToken}`);

      expect(statusResponse.status).to.equal(200);
    });

    it('should complete volunteer journey from signup to call acceptance', async () => {
      // 1. Volunteer signup (already done in setup)
      expect(volunteerUser).to.be.an('object');
      expect(volunteerToken).to.be.a('string');

      // 2. Update availability
      const availResponse = await request(app)
        .put('/api/users/availability')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          isAvailable: true,
          preferredHours: {
            start: '09:00',
            end: '17:00'
          }
        });

      expect(availResponse.status).to.equal(200);

      // 3. Get user stats
      const statsResponse = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${volunteerToken}`);

      expect(statsResponse.status).to.equal(200);
      expect(statsResponse.body.data).to.have.property('totalCalls');

      // 4. Accept match (when available)
      // First create a match scenario
      const matchResponse = await request(app)
        .post('/api/matching/start')
        .set('Authorization', `Bearer ${blindToken}`)
        .send({});

      const roomId = matchResponse.body.data.roomId;

      // Accept the match
      const acceptResponse = await request(app)
        .post(`/api/matching/accept/${roomId}`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({});

      expect(acceptResponse.status).to.equal(200);
    });
  });

  describe('Real-time Features', () => {
    let wsConnections = [];

    const createWebSocketConnection = (token, userType) => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3000/api/webrtc/ws');

        ws.on('open', () => {
          // Authenticate WebSocket
          ws.send(JSON.stringify({
            type: 'auth',
            token: token,
            userType: userType
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'auth_success') {
            resolve({ ws, message });
          }
        });

        ws.on('error', reject);

        wsConnections.push({ ws, userType });
      });
    };

    it('should establish WebSocket connections for both users', async () => {
      // Create WebSocket connections
      const blindWS = await createWebSocketConnection(blindToken, 'blind');
      const volunteerWS = await createWebSocketConnection(volunteerToken, 'volunteer');

      expect(blindWS.message.userType).to.equal('blind');
      expect(volunteerWS.message.userType).to.equal('volunteer');
    }).timeout(5000);

    it('should handle WebRTC signaling messages', async () => {
      const blindWS = await createWebSocketConnection(blindToken, 'blind');
      const volunteerWS = await createWebSocketConnection(volunteerToken, 'volunteer');

      // Test offer/answer exchange
      const offerData = {
        type: 'offer',
        roomId: 'test-room',
        sdp: 'mock-offer-sdp'
      };

      blindWS.ws.send(JSON.stringify(offerData));

      // Volunteer should receive offer
      const receivedOffer = await new Promise(resolve => {
        volunteerWS.ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'offer') {
            resolve(message);
          }
        });
      });

      expect(receivedOffer.roomId).to.equal(offerData.roomId);

      // Test answer response
      const answerData = {
        type: 'answer',
        roomId: 'test-room',
        sdp: 'mock-answer-sdp'
      };

      volunteerWS.ws.send(JSON.stringify(answerData));

      const receivedAnswer = await new Promise(resolve => {
        blindWS.ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'answer') {
            resolve(message);
          }
        });
      });

      expect(receivedAnswer.roomId).to.equal(answerData.roomId);
    }).timeout(5000);
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      // Make concurrent profile requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${blindToken}`)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(200);
      });

      // Should complete within reasonable time (< 1 second per request)
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;
      expect(avgTimePerRequest).to.be.below(1000); // 1 second max
    });

    it('should handle rate limiting appropriately', async () => {
      // Make multiple rapid requests to test rate limiting
      const rapidRequests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${blindToken}`)
      );

      const responses = await Promise.allSettled(rapidRequests);

      // Some requests should be rate limited (429 status)
      const rateLimited = responses.some(response =>
        response.status === 429 ||
        (response.value && response.value.status === 429)
      );

      expect(rateLimited).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ invalid: 'data' });

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      expect(response.body.error.code).to.equal('VALIDATION_ERROR');
    });

    it('should handle missing endpoints gracefully', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint');

      expect(response.status).to.equal(404);
      expect(response.body.error.code).to.equal('NOT_FOUND');
    });

    it('should handle method not allowed gracefully', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${blindToken}`);

      expect(response.status).to.equal(405);
    });
  });

  describe('Database Operations', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database disconnection
      // For now, test with invalid database operations
      const response = await request(app)
        .get('/api/admin/users/invalid-user-id')
        .set('Authorization', `Bearer ${volunteerToken}`);

      expect(response.status).to.equal(404);
    });

    it('should maintain data consistency', async () => {
      // Update user profile
      const updateData = {
        preferences: {
          language: 'spanish',
          assistanceType: 'reading'
        }
      };

      const updateResponse = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${blindToken}`)
        .send(updateData);

      expect(updateResponse.status).to.equal(200);

      // Verify the update persists
      const getResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${blindToken}`);

      expect(getResponse.status).to.equal(200);
      expect(getResponse.body.data.user.preferences.language).to.equal('spanish');
      expect(getResponse.body.data.user.preferences.assistanceType).to.equal('reading');
    });
  });

  // Cleanup WebSocket connections after tests
  afterEach(() => {
    wsConnections.forEach(({ ws }) => {
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    });
    wsConnections = [];
  });
});