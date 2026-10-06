'use strict';

require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.DASHBOARD_ORIGIN || 'http://localhost:5173']
    : '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// ─── Raw body capture (needed for webhook signature validation) ───────────────
app.use('/webhooks', express.raw({ type: '*/*' }), (req, res, next) => {
  req.rawBody = req.body;
  try {
    req.body = JSON.parse(req.body.toString());
  } catch {
    req.body = {};
  }
  next();
});

// ─── JSON body parsing ────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── HTTP request logging ─────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  // Skip health check logging
  skip: (req) => req.path === '/health',
}));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', routes);

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
