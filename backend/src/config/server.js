module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Rate limiting
  rateLimit: {
    max: 100, // max requests per window
    windowMs: 15 * 60 * 1000, // 15 minutes
  },

  // CORS
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://solsight.app', 'https://www.solsight.app']
      : ['http://localhost:19006', 'exp://192.168.1.100:19000'], // Expo development URLs
    credentials: true,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_jwt_secret',
    expiresIn: '15m',
    refreshSecret: process.env.REFRESH_SECRET || 'fallback_refresh_secret',
    refreshExpiresIn: '7d',
  },

  // WebRTC
  webrtc: {
    stunServer: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302',
    turnServer: process.env.TURN_SERVER,
    turnUsername: process.env.TURN_USERNAME,
    turnPassword: process.env.TURN_PASSWORD,
    maxCallDuration: 2 * 60 * 60 * 1000, // 2 hours
    connectionTimeout: 30 * 1000, // 30 seconds
  },

  // Matching
  matching: {
    maxWaitTime: 2 * 60 * 1000, // 2 minutes
    maxConcurrentCalls: 1,
    reputationWeight: 0.1,
    skillCategories: ['reading', 'navigation', 'tech_help', 'general'],
  },

  // Rewards
  rewards: {
    // Base rewards (in SOL)
    shortCall: 0.01,    // 5-30 min
    mediumCall: 0.025,  // 30-60 min
    longCall: 0.05,     // 60+ min

    // Bonuses
    perfectRating: 0.005,
    quickResponse: 0.003,

    // Milestones
    calls10: 0.1,
    calls50: 0.5,
    calls100: 1.0,
    calls500: 5.0,
    calls1000: 10.0,
  },

  // Logging
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    file: 'logs/app.log',
  },
};