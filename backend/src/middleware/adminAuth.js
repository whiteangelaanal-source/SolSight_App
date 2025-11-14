const { requireRole, authenticateToken } = require('./auth');
const { logger } = require('../utils/logger');

// Require admin authentication and role
const requireAdmin = [
  authenticateToken,
  requireRole('admin')
];

// Admin action logger for audit trail
const logAdminAction = (action) => {
  return (req, res, next) => {
    const { user } = req;

    logger.info('Admin action performed', {
      adminId: user.id,
      adminEmail: user.email,
      action: action,
      resource: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      body: req.method !== 'GET' ? req.body : undefined
    });

    next();
  };
};

// Admin action validation middleware
const validateAdminAction = (actionType) => {
  return (req, res, next) => {
    const { user } = req;

    // Check if admin has permission for this action
    // This could be extended with more granular permissions
    const adminPermissions = {
      'user_management': true,
      'system_analytics': true,
      'call_management': true,
      'system_health': true,
    };

    if (!adminPermissions[actionType]) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin does not have permission for this action'
        }
      });
    }

    next();
  };
};

module.exports = {
  requireAdmin,
  logAdminAction,
  validateAdminAction,
};