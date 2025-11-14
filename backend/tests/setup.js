const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');

let mongoServer;
let redisServer;

// Setup test database
const setupTestDatabase = async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'solsight_test'
    }
  });

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
  process.env.REDIS_URL = 'redis://localhost:6379';
};

// Cleanup test database
const cleanupTestDatabase = async () => {
  if (mongoServer) {
    await mongoServer.stop();
  }
};

// Start Redis for testing
const setupRedis = () => {
  redisServer = spawn('redis-server', ['--port', '6380', '--requirepass', 'testpass'], {
    stdio: 'pipe',
    detached: true
  });

  // Give Redis time to start
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      redisServer.unref();
      resolve();
    }, 2000);
  });
};

const stopRedis = () => {
  if (redisServer) {
    redisServer.kill();
  }
};

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase,
  setupRedis,
  stopRedis
};