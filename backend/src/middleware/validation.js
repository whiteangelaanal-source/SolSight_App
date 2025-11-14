const Joi = require('joi');
const { ValidationError, handleValidationError } = require('../utils/errors');

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        handleValidationError(error);
      }

      // Replace the request property with validated data
      req[property] = value;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Common validation schemas
const schemas = {
  // User registration
  userRegistration: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'Password is required',
    }),
    firstName: Joi.string().min(2).max(50).required().messages({
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required',
    }),
    lastName: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Last name must be at least 2 characters',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required',
    }),
    userType: Joi.string().valid('blind', 'volunteer').required().messages({
      'any.only': 'User type must be either "blind" or "volunteer"',
      'any.required': 'User type is required',
    }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({
      'string.pattern.base': 'Please provide a valid phone number with country code',
      'any.required': 'Phone number is required',
    }),
  }),

  // User login
  userLogin: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  }),

  // Refresh token
  refreshToken: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required',
    }),
  }),

  // Call creation
  createCall: Joi.object({
    helpCategory: Joi.string().valid('reading', 'navigation', 'tech_help', 'general').default('general').messages({
      'any.only': 'Help category must be one of: reading, navigation, tech_help, general',
    }),
    description: Joi.string().max(500).optional().messages({
      'string.max': 'Description cannot exceed 500 characters',
    }),
    volunteerId: Joi.string().optional().messages({
      'string.empty': 'Volunteer ID cannot be empty',
    }),
  }),

  // Call update
  updateCall: Joi.object({
    status: Joi.string().valid('pending', 'active', 'completed', 'failed').optional(),
    rating: Joi.number().integer().min(1).max(5).optional().messages({
      'number.base': 'Rating must be a number',
      'number.integer': 'Rating must be an integer',
      'number.min': 'Rating must be at least 1',
      'number.max': 'Rating cannot exceed 5',
    }),
    feedbackText: Joi.string().max(1000).optional().messages({
      'string.max': 'Feedback cannot exceed 1000 characters',
    }),
    endedAt: Joi.date().optional(),
    durationSeconds: Joi.number().integer().min(0).optional().messages({
      'number.base': 'Duration must be a number',
      'number.integer': 'Duration must be an integer',
      'number.min': 'Duration cannot be negative',
    }),
  }),

  // User profile update
  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    walletAddress: Joi.string().base58().optional().messages({
      'string.base58': 'Please provide a valid Solana wallet address',
    }),
    isAvailable: Joi.boolean().optional(),
  }),

  // Wallet address validation
  walletAddress: Joi.object({
    walletAddress: Joi.string().base58().required().messages({
      'string.base58': 'Please provide a valid Solana wallet address',
      'any.required': 'Wallet address is required',
    }),
  }),

  // Matching request
  matchingRequest: Joi.object({
    helpCategory: Joi.string().valid('reading', 'navigation', 'tech_help', 'general').default('general'),
    priority: Joi.number().integer().min(1).max(10).default(5),
    timeoutMs: Joi.number().integer().min(5000).max(300000).default(120000), // 5 seconds to 5 minutes
  }),

  // WebRTC room
  joinRoom: Joi.object({
    roomId: Joi.string().required().messages({
      'any.required': 'Room ID is required',
    }),
    userId: Joi.string().required().messages({
      'any.required': 'User ID is required',
    }),
    userType: Joi.string().valid('blind', 'volunteer').required().messages({
      'any.only': 'User type must be either "blind" or "volunteer"',
      'any.required': 'User type is required',
    }),
  }),

  // WebRTC signaling
  webrtcSignal: Joi.object({
    roomId: Joi.string().required(),
    signal: Joi.object({
      type: Joi.string().valid('offer', 'answer', 'ice-candidate').required(),
      data: Joi.any().required(),
    }).required(),
  }),

  // Reward distribution
  rewardDistribution: Joi.object({
    userId: Joi.string().required(),
    rewardType: Joi.string().valid('call_completion', 'milestone', 'bonus').required(),
    amount: Joi.number().positive().required(),
    reason: Joi.string().max(200).required(),
    callId: Joi.string().optional(),
  }),
};

// Custom validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

const validateSolanaAddress = (address) => {
  try {
    // Use the blockchain validation if available, otherwise basic validation
    if (typeof address === 'string' && address.length >= 32 && address.length <= 44) {
      return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
    }
    return false;
  } catch (error) {
    return false;
  }
};

// Sanitization functions
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

const sanitizeInput = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

module.exports = {
  validate,
  schemas,
  validateEmail,
  validatePhone,
  validateSolanaAddress,
  sanitizeString,
  sanitizeInput,
};