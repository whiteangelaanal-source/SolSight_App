require('dotenv').config();
const fastify = require('fastify');
const { errorHandler } = require('./utils/errors');
const { logger } = require('./utils/logger');
const config = require('./config/server');

// Register plugins
const app = fastify({
  logger: false, // Use custom logger
  trustProxy: true,
});

// Register CORS
app.register(require('@fastify/cors'), config.cors);

// Register rate limiting
app.register(require('@fastify/rate-limit'), config.rateLimit);

// Register WebSocket support
app.register(require('@fastify/websocket'));

// Register routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const matchingRoutes = require('./routes/matching');
const callsRoutes = require('./routes/calls');
const rewardsRoutes = require('./routes/rewards');
const webrtcRoutes = require('./routes/webrtc');
const adminRoutes = require('./routes/admin');

// Route registration
const registerRoutes = async () => {
  // Health check endpoint
  app.get('/health', async (request, reply) => {
    return {
      success: true,
      data: {
        service: 'solsight-api',
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
      },
      message: 'SolSight API is healthy',
    };
  });

  // API routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(matchingRoutes, { prefix: '/api/matching' });
  await app.register(callsRoutes, { prefix: '/api/calls' });
  await app.register(rewardsRoutes, { prefix: '/api/rewards' });
  await app.register(webrtcRoutes, { prefix: '/api/webrtc' });

  // API documentation endpoint
  app.get('/api', async (request, reply) => {
    return {
      success: true,
      data: {
        version: '1.0.0',
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          matching: '/api/matching',
          calls: '/api/calls',
          rewards: '/api/rewards',
          webrtc: '/api/webrtc',
        },
        documentation: '/api/docs',
        websocket: '/api/webrtc/ws',
        health: '/health',
      },
      message: 'SolSight API endpoints',
    };
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  logger.info('Routes registered successfully');
};

// Request logging middleware
app.addHook('onRequest', async (request, reply) => {
  const startTime = Date.now();

  request.startTime = startTime;

  // Log request
  logger.debug(`${request.method} ${request.url}`, {
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
  });
});

app.addHook('onResponse', async (request, reply) => {
  const responseTime = Date.now() - request.startTime;

  // Log response
  logger.debug(`${request.method} ${request.url} - ${reply.statusCode}`, {
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    await app.close();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const start = async () => {
  try {
    await registerRoutes();

    await app.listen({
      port: config.port,
      host: '0.0.0.0'
    });

    logger.info(`SolSight API server listening on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
    logger.info(`API documentation: http://localhost:${config.port}/api`);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server if this file is run directly
if (require.main === module) {
  start();
}

module.exports = app;