'use strict';

const app = require('./src/app');
const { connectDatabase } = require('./src/config/database');
const config = require('./src/config');
const logger = require('./src/utils/logger');

async function start() {
  try {
    await connectDatabase();
    await seedDefaultCategories();

    const server = app.listen(config.port, () => {
      logger.info(`Officerestore WhatsApp Bot API started`, {
        port: config.port,
        env: config.env,
        catalogue: config.catalogue.provider,
        orders: config.orders.provider,
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

async function gracefulShutdown(server) {
  logger.info('Graceful shutdown initiated');
  server.close(async () => {
    const { disconnectDatabase } = require('./src/config/database');
    await disconnectDatabase();
    logger.info('Server shut down cleanly');
    process.exit(0);
  });
}

async function seedDefaultCategories() {
  try {
    const ProductCategory = require('./src/models/ProductCategory');
    const { MOCK_CATEGORIES } = require('./src/services/catalogue/catalogueService');
    const count = await ProductCategory.countDocuments();
    if (count === 0) {
      await ProductCategory.insertMany(MOCK_CATEGORIES);
      logger.info('Default product categories seeded');
    }
  } catch (err) {
    logger.warn('Category seeding skipped', { error: err.message });
  }
}

start();
