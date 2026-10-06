'use strict';

const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

let isConnected = false;

async function connectDatabase() {
  if (isConnected) return;

  try {
    await mongoose.connect(config.mongodb.uri, {
      dbName: config.mongodb.dbName,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    logger.info('MongoDB connected', { db: config.mongodb.dbName });
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    throw err;
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  logger.info('MongoDB reconnected');
});

async function disconnectDatabase() {
  await mongoose.disconnect();
  isConnected = false;
}

module.exports = { connectDatabase, disconnectDatabase };
