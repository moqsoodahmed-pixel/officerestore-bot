'use strict';

require('dotenv').config();

function required(key) {
  const value = process.env[key];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

function optional(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  apiBaseUrl: optional('API_BASE_URL', 'http://localhost:3000'),

  mongodb: {
    uri: optional('MONGODB_URI', 'mongodb://localhost:27017/officerestore_bot'),
    dbName: optional('MONGODB_DB_NAME', 'officerestore_bot'),
  },

  msg91: {
    authKey: optional('MSG91_AUTH_KEY', 'MOCK_AUTH_KEY'),
    whatsappNumber: optional('MSG91_WHATSAPP_NUMBER', '919999999999'),
    namespace: optional('MSG91_NAMESPACE', 'mock_namespace'),
    webhookSecret: optional('MSG91_WEBHOOK_SECRET', 'mock_webhook_secret'),
    apiBaseUrl: optional('MSG91_API_BASE_URL', 'https://api.msg91.com/api/v5'),
  },

  catalogue: {
    provider: optional('CATALOGUE_PROVIDER', 'mock'),
    woocommerce: {
      baseUrl: optional('WOOCOMMERCE_BASE_URL'),
      consumerKey: optional('WOOCOMMERCE_CONSUMER_KEY'),
      consumerSecret: optional('WOOCOMMERCE_CONSUMER_SECRET'),
    },
    shopify: {
      storeDomain: optional('SHOPIFY_STORE_DOMAIN'),
      accessToken: optional('SHOPIFY_ACCESS_TOKEN'),
    },
    custom: {
      baseUrl: optional('CATALOGUE_API_BASE_URL'),
      apiKey: optional('CATALOGUE_API_KEY'),
    },
  },

  orders: {
    provider: optional('ORDER_PROVIDER', 'mock'),
    apiBaseUrl: optional('ORDER_API_BASE_URL'),
    apiKey: optional('ORDER_API_KEY'),
  },

  crm: {
    provider: optional('CRM_PROVIDER', 'mock'),
    apiBaseUrl: optional('CRM_API_BASE_URL'),
    apiKey: optional('CRM_API_KEY'),
  },

  security: {
    jwtSecret: optional('JWT_SECRET', 'dev_jwt_secret_change_in_production'),
    adminApiKey: optional('ADMIN_API_KEY', 'dev_admin_key'),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '60'), 10),
    webhookMax: parseInt(optional('WEBHOOK_RATE_LIMIT_MAX', '120'), 10),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
    format: optional('LOG_FORMAT', 'json'),
  },

  conversation: {
    timeoutSeconds: parseInt(optional('CONVERSATION_TIMEOUT_SECONDS', '1800'), 10),
  },

  support: {
    email: optional('SUPPORT_EMAIL', 'support@officerestore.com'),
    phone: optional('SUPPORT_PHONE', '+91XXXXXXXXXX'),
    hours: optional('SUPPORT_HOURS', 'Mon-Sat 9AM-6PM IST'),
  },

  isMock() {
    return this.env !== 'production';
  },
};

module.exports = config;
