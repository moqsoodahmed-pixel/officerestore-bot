'use strict';

const config = require('../config');
const logger = require('../utils/logger');

/**
 * Admin API key authentication middleware.
 * Checks X-API-Key header against ADMIN_API_KEY env var.
 */
function requireAdminAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey || apiKey !== config.security.adminApiKey) {
    logger.warn('Unauthorized admin API access', { ip: req.ip, path: req.path });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  req.admin = { id: 'admin', apiKey };
  next();
}

module.exports = { requireAdminAuth };
