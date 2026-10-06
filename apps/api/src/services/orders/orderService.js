'use strict';

const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Order service abstraction.
 * NEVER expose order details without authentication.
 * NEVER disclose whether an order exists if auth fails.
 */

const mockProvider = {
  async lookupOrder(orderRef, whatsappNumber) {
    logger.info('[MOCK] orderService.lookupOrder', { orderRef });
    // In production, verify the whatsappNumber matches the order's registered contact
    // Return null to simulate "not found / auth failed"
    return null;
  },
};

const customProvider = {
  async lookupOrder(orderRef, whatsappNumber) {
    // TODO: GET {ORDER_API_BASE_URL}/orders/{orderRef}
    // Verify that the requesting whatsappNumber matches order's registered contact
    // Return only: { orderId, status, trackingUrl, nextStep }
    throw new Error('Order provider not yet configured');
  },
};

function getProvider() {
  return config.orders.provider === 'custom' ? customProvider : mockProvider;
}

/**
 * Look up an order — returns minimal customer-safe info or null if not found/auth fails.
 * NEVER reveal whether an order exists if auth fails.
 */
async function lookupOrder(orderRef, whatsappNumber) {
  try {
    return await getProvider().lookupOrder(orderRef, whatsappNumber);
  } catch (err) {
    logger.error('Order lookup failed', { error: err.message, orderRef });
    return null;
  }
}

module.exports = { lookupOrder };
