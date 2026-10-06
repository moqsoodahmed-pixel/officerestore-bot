'use strict';

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'An internal error occurred';

  logger.error('Unhandled error', {
    status,
    message: err.message,
    path: req.path,
    method: req.method,
    stack: status >= 500 ? err.stack : undefined,
  });

  // Never expose stack traces or internal details to clients
  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && status >= 500 && { debug: err.message }),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Not found' });
}

module.exports = { errorHandler, notFoundHandler };
