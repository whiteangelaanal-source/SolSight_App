const { expect } = require('chai');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { setupTestDatabase, cleanupTestDatabase } = require('../setup');

const app = require('../../src/app');

describe('Authentication Endpoints', () => {
  before(async () => {
    await setupTestDatabase();
  });

  after(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        userType: 'volunteer',
        phone: '+1234567890',
        location: 'New York, USA'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).to.equal(201);
      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('user');
      expect(response.body.data).to.have.property('accessToken');
      expect(response.body.data).to.have.property('refreshToken');
    });

    it('should return error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).to.equal(400);
      expect(response.body.success).to.be.false;
      expect(response.body.error.code).to.equal('VALIDATION_ERROR');
    });

    it('should return error for duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          userType: 'volunteer'
        });

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User 2',
          email: 'test@example.com',
          password: 'password456',
          userType: 'blind'
        });

      expect(response.status).to.equal(400);
      expect(response.body.error.code).to.equal('EMAIL_EXISTS');
    });
  });

  describe('POST /auth/login', () => {
    let userId;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'login@example.com',
          password: 'password123',
          userType: 'volunteer'
        });
      userId = registerResponse.body.data.user.id;
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123'
        });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data.user.email).to.equal('login@example.com');
      expect(response.body.data).to.have.property('accessToken');
      expect(response.body.data).to.have.property('refreshToken');
    });

    it('should return error for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).to.equal(401);
      expect(response.body.success).to.be.false;
      expect(response.body.error.code).to.equal('INVALID_CREDENTIALS');
    });

    it('should return error for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).to.equal(401);
      expect(response.body.error.code).to.equal('INVALID_CREDENTIALS');
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'refresh@example.com',
          password: 'password123',
          userType: 'volunteer'
        });
      refreshToken = registerResponse.body.data.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('accessToken');
      expect(response.body.data).to.have.property('refreshToken');
    });

    it('should return error for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).to.equal(401);
      expect(response.body.error.code).to.equal('INVALID_REFRESH_TOKEN');
    });
  });

  describe('Authentication Middleware', () => {
    let validToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'middleware@example.com',
          password: 'password123',
          userType: 'volunteer'
        });
      validToken = registerResponse.body.data.accessToken;
    });

    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).to.equal(200);
    });

    it('should deny access without token', async () => {
      const response = await request(app)
        .get('/api/users/profile');

      expect(response.status).to.equal(401);
      expect(response.body.error.code).to.equal('TOKEN_REQUIRED');
    });

    it('should deny access with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user-id' },
        'test-secret',
        { expiresIn: '-1s' }
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).to.equal(401);
      expect(response.body.error.code).to.equal('TOKEN_EXPIRED');
    });
  });
});