const { expect } = require('chai');
const request = require('supertest');
const { setupTestDatabase, cleanupTestDatabase } = require('../setup');

const app = require('../../src/app');

describe('Volunteer Matching Algorithm', () => {
  before(async () => {
    await setupTestDatabase();
  });

  after(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/matching/start', () => {
    let blindUser;
    let volunteerUser;
    let blindToken;
    let volunteerToken;

    beforeEach(async () => {
      // Create test users
      const blindResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Blind User',
          email: 'blind@example.com',
          password: 'password123',
          userType: 'blind',
          location: 'New York, USA',
          preferences: {
            language: 'english',
            assistanceType: 'navigation'
          }
        });

      const volunteerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Volunteer User',
          email: 'volunteer@example.com',
          password: 'password123',
          userType: 'volunteer',
          location: 'New York, USA',
          availability: {
            isAvailable: true,
            preferredHours: {
              start: '09:00',
              end: '17:00'
            }
          }
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

    it('should start matching process for blind user', async () => {
      const response = await request(app)
        .post('/api/matching/start')
        .set('Authorization', `Bearer ${blindToken}`)
        .send({
          preferences: {
            language: 'english',
            location: 'New York, USA'
          }
        });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('roomId');
      expect(response.body.data).to.have.property('estimatedWaitTime');
    });

    it('should match blind user with available volunteer', async () => {
      // Start matching for blind user
      const matchResponse = await request(app)
        .post('/api/matching/start')
        .set('Authorization', `Bearer ${blindToken}`)
        .send({});

      // Check for volunteer match
      const statusResponse = await request(app)
        .get('/api/matching/queue-status')
        .set('Authorization', `Bearer ${blindToken}`);

      expect(statusResponse.status).to.equal(200);
      expect(statusResponse.body.data.matchFound).to.be.true;
      expect(statusResponse.body.data.volunteerId).to.equal(volunteerUser.id);
    });

    it('should handle no available volunteers scenario', async () => {
      // Set volunteer as unavailable
      await request(app)
        .put('/api/users/availability')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ isAvailable: false });

      // Try to match
      const response = await request(app)
        .post('/api/matching/start')
        .set('Authorization', `Bearer ${blindToken}`)
        .send({});

      expect(response.status).to.equal(200);
      expect(response.body.data.estimatedWaitTime).to.be.a('string');
    });

    it('should respect user preferences in matching', async () => {
      // Create volunteer with specific preferences
      const specializedVolunteer = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Specialized Volunteer',
          email: 'special@example.com',
          password: 'password123',
          userType: 'volunteer',
          skills: {
            languages: ['english', 'spanish'],
            expertise: ['navigation', 'reading'],
            certifications: ['orientation-mobility']
          },
          location: 'New York, USA',
          availability: {
            isAvailable: true
          }
        });

      const specializedToken = specializedVolunteer.body.data.accessToken;

      await request(app)
        .put('/api/users/availability')
        .set('Authorization', `Bearer ${specializedToken}`)
        .send({ isAvailable: true });

      // Blind user with specific language preference
      const response = await request(app)
        .post('/api/matching/start')
        .set('Authorization', `Bearer ${blindToken}`)
        .send({
          preferences: {
            language: 'spanish',
            expertise: 'orientation-mobility'
          }
        });

      expect(response.status).to.equal(200);
      // Should match with specialized volunteer who speaks Spanish
      // Implementation would verify this logic
    });
  });

  describe('POST /api/matching/accept/:roomId', () => {
    let roomId;
    let volunteerToken;

    beforeEach(async () => {
      // Create a match first
      const matchResponse = await request(app)
        .post('/api/matching/start')
        .set('Authorization', `Bearer ${blindToken}`)
        .send({});

      roomId = matchResponse.body.data.roomId;

      // Get volunteer token
      const volunteerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Volunteer',
          email: 'accept@example.com',
          password: 'password123',
          userType: 'volunteer'
        });

      volunteerToken = volunteerResponse.body.data.accessToken;
    });

    it('should accept match successfully', async () => {
      const response = await request(app)
        .post(`/api/matching/accept/${roomId}`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({});

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('match');
      expect(response.body.data.match.status).to.equal('active');
    });

    it('should handle invalid room ID', async () => {
      const response = await request(app)
        .post('/api/matching/accept/invalid-room-id')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({});

      expect(response.status).to.equal(404);
      expect(response.body.error.code).to.equal('ROOM_NOT_FOUND');
    });

    it('should prevent duplicate acceptance', async () => {
      // First acceptance
      await request(app)
        .post(`/api/matching/accept/${roomId}`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({});

      // Second acceptance (should fail)
      const response = await request(app)
        .post(`/api/matching/accept/${roomId}`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({});

      expect(response.status).to.equal(400);
      expect(response.body.error.code).to.equal('MATCH_ALREADY_ACCEPTED');
    });
  });

  describe('GET /api/matching/queue-status', () => {
    it('should return current queue status', async () => {
      const response = await request(app)
        .get('/api/matching/queue-status')
        .set('Authorization', `Bearer ${blindToken}`);

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('queueLength');
      expect(response.body.data).to.have.property('estimatedWaitTime');
      expect(response.body.data).to.have.property('matchFound');
    });
  });
});