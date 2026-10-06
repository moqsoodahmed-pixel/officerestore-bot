'use strict';

const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Validate MSG91 webhook signature.
 * MSG91 sends an HMAC-SHA256 signature in the X-Hub-Signature-256 header.
 * In mock/dev mode with no real secret, validation is skipped.
 */
function validateWebhookSignature(rawBody, signatureHeader) {
  if (config.msg91.webhookSecret === 'mock_webhook_secret') {
    logger.warn('Webhook signature validation skipped (mock mode)');
    return true;
  }

  if (!signatureHeader) {
    logger.warn('Missing webhook signature header');
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', config.msg91.webhookSecret)
    .update(rawBody)
    .digest('hex')}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/**
 * Parse a raw MSG91 webhook payload into a normalized event object.
 * Returns null if the payload is unrecognized or not actionable.
 *
 * MSG91 WhatsApp webhook shape (approximate — verify against your MSG91 docs):
 * {
 *   data: {
 *     id: string,          // provider message ID
 *     from: string,        // sender's WhatsApp number
 *     type: 'text' | 'interactive' | 'image' | ...
 *     timestamp: number,
 *     text?: { body: string },
 *     interactive?: {
 *       type: 'list_reply' | 'button_reply',
 *       list_reply?: { id: string, title: string },
 *       button_reply?: { id: string, title: string },
 *     },
 *     contacts?: [{ profile: { name: string } }]
 *   }
 * }
 */
function parseWebhookEvent(body) {
  try {
    const data = body?.data || body;
    if (!data || !data.from) return null;

    const eventId = data.id || `unknown-${Date.now()}`;
    const from = String(data.from).replace(/\D/g, '');
    const type = data.type;
    const timestamp = data.timestamp ? new Date(data.timestamp * 1000) : new Date();
    const senderName = data.contacts?.[0]?.profile?.name || null;

    let text = null;
    let interactiveId = null;
    let interactiveTitle = null;
    let interactiveType = null;

    if (type === 'text') {
      text = data.text?.body?.trim() || null;
    } else if (type === 'interactive') {
      const interactive = data.interactive || {};
      interactiveType = interactive.type;
      if (interactive.type === 'list_reply') {
        interactiveId = interactive.list_reply?.id;
        interactiveTitle = interactive.list_reply?.title;
      } else if (interactive.type === 'button_reply') {
        interactiveId = interactive.button_reply?.id;
        interactiveTitle = interactive.button_reply?.title;
      }
    } else if (['image', 'document', 'audio', 'video'].includes(type)) {
      text = `[${type} received]`;
    }

    return {
      eventId,
      messageId: eventId,
      from,
      type,
      timestamp,
      senderName,
      text,
      interactiveId,
      interactiveTitle,
      interactiveType,
      raw: data,
    };
  } catch (err) {
    logger.error('Failed to parse webhook event', { error: err.message });
    return null;
  }
}

module.exports = { validateWebhookSignature, parseWebhookEvent };
