const winston = require('winston');
const path = require('path');
const config = require('../config/server');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create Winston logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'solsight-api' },
  transports: [
    // Write all logs to file
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write error logs to separate file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],
});

// Add console transport for development
if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper functions for consistent logging
const logRequest = (req, res, responseTime) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
};

const logError = (error, context = {}) => {
  logger.error('Application Error', {
    error: error.message,
    stack: error.stack,
    ...context,
  });
};

const logWebSocketEvent = (event, data, userId = null) => {
  logger.info('WebSocket Event', {
    event,
    data,
    userId,
    timestamp: new Date().toISOString(),
  });
};

const logBlockchainTransaction = (type, signature, from, to, amount) => {
  logger.info('Blockchain Transaction', {
    type,
    signature,
    from,
    to,
    amount,
    timestamp: new Date().toISOString(),
  });
};

const logMatchAttempt = (blindUserId, category, result) => {
  logger.info('Volunteer Match Attempt', {
    blindUserId,
    category,
    result,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  logger,
  logRequest,
  logError,
  logWebSocketEvent,
  logBlockchainTransaction,
  logMatchAttempt,
};