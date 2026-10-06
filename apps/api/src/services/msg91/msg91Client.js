'use strict';

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Low-level MSG91 HTTP client.
 * All API calls go through this module so credentials are in one place.
 *
 * The rest of the app builds Meta-style payloads:
 *   { from, to, type: 'text' | 'interactive' | 'template', text | interactive | template }
 * This module converts them into MSG91's "session message" format:
 *   POST /whatsapp/whatsapp-outbound-message/
 *   { integrated_number, recipient_number, content_type, text | interactive }
 */

// Override with MSG91_SEND_PATH in Railway if MSG91 ever changes the path.
const SEND_PATH = process.env.MSG91_SEND_PATH || '/whatsapp/whatsapp-outbound-message/';

const client = axios.create({
  baseURL: config.msg91.apiBaseUrl,
  headers: {
    authkey: config.msg91.authKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    logger.error('MSG91 API error', {
      status,
      url: `${err.config?.baseURL || ''}${err.config?.url || ''}`,
      data: typeof data === 'string' ? data.substring(0, 500) : JSON.stringify(data),
      sent: err.config?.data ? String(err.config.data).substring(0, 500) : undefined,
    });
    return Promise.reject(err);
  }
);

/**
 * Convert the internal Meta-style payload into MSG91's session-message body.
 */
function toMsg91Body(payload) {
  const body = {
    integrated_number: String(payload.from || config.msg91.whatsappNumber).replace(/\D/g, ''),
    recipient_number: String(payload.to).replace(/\D/g, ''),
    content_type: payload.type,
  };

  switch (payload.type) {
    case 'text':
      body.text = payload.text?.body ?? payload.text ?? '';
      break;
    case 'interactive':
      body.interactive = payload.interactive;
      break;
    case 'template':
      body.template = payload.template;
      break;
    default:
      // image / document / etc. — pass the matching object through
      if (payload[payload.type]) body[payload.type] = payload[payload.type];
  }

  return body;
}

/**
 * Send a WhatsApp message via MSG91.
 * @param {object} payload - Meta-style WhatsApp message payload
 */
async function sendWhatsApp(payload) {
  if (config.isMock() && config.msg91.authKey === 'MOCK_AUTH_KEY') {
    logger.info('[MOCK] MSG91 sendWhatsApp', { to: payload.to, type: payload.type });
    return { type: 'mock', messageId: `mock-${Date.now()}` };
  }

  const res = await client.post(SEND_PATH, toMsg91Body(payload));
  const data = res.data || {};

  // MSG91 sometimes returns HTTP 200 with an error inside the body
  if (data.status === 'fail' || data.hasError === true || data.type === 'error') {
    logger.error('MSG91 send rejected', { response: JSON.stringify(data).substring(0, 500) });
    throw new Error(`MSG91 rejected message: ${data.message || data.errors || 'unknown error'}`);
  }

  return {
    ...data,
    messageId: data.data?.message_uuid || data.request_id || data.data?.id || data.messageId,
  };
}

module.exports = { sendWhatsApp, toMsg91Body };