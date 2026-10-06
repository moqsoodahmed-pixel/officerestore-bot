'use strict';

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Low-level MSG91 HTTP client.
 * All API calls go through this module so credentials are in one place.
 */

const client = axios.create({
  baseURL: config.msg91.apiBaseUrl,
  headers: {
    authkey: config.msg91.authKey,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    logger.error('MSG91 API error', { status, data: JSON.stringify(data) });
    return Promise.reject(err);
  }
);

/**
 * Send a WhatsApp message via MSG91.
 * @param {object} payload - MSG91 WhatsApp message payload
 */
async function sendWhatsApp(payload) {
  if (config.isMock() && config.msg91.authKey === 'MOCK_AUTH_KEY') {
    logger.info('[MOCK] MSG91 sendWhatsApp', { to: payload.to, type: payload.type });
    return { type: 'mock', messageId: `mock-${Date.now()}` };
  }

  const res = await client.post('/whatsapp/whatsapp-outbound-message/send/', payload);
  return res.data;
}

module.exports = { sendWhatsApp };
