'use strict';

const { validateWebhookSignature, parseWebhookEvent } = require('../services/msg91/webhookService');
const { processEvent } = require('../conversation/conversationEngine');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * POST /webhooks/whatsapp
 *
 * Security requirements:
 *  - Validate HMAC signature
 *  - Deduplicate event (handled in conversationEngine)
 *  - Acknowledge immediately (200) and process asynchronously
 *  - Never expose internal errors to webhook sender
 */
async function handleWhatsAppWebhook(req, res) {
  // Acknowledge quickly — MSG91 expects a fast 200
  res.status(200).json({ status: 'ok' });

  const rawBody = req.rawBody;
  const signature = req.headers['x-hub-signature-256'] || req.headers['x-msg91-signature'] || '';

  // Validate signature
  if (!validateWebhookSignature(rawBody, signature)) {
    logger.warn('Webhook signature validation failed');
    await AuditLog.create({
      eventType: 'webhook_invalid',
      meta: { reason: 'signature_mismatch' },
      severity: 'warn',
    }).catch(() => {});
    return;
  }

  const body = req.body;

  await AuditLog.create({
    eventType: 'webhook_received',
    meta: { type: body?.data?.type || 'unknown' },
  }).catch(() => {});

  // Parse event
  const parsedEvent = parseWebhookEvent(body);
  if (!parsedEvent) {
    logger.warn('Unrecognized webhook payload', { body: JSON.stringify(body).substring(0, 200) });
    return;
  }

  logger.info('Webhook event received', {
    from: parsedEvent.from,
    type: parsedEvent.type,
    messageId: parsedEvent.messageId,
  });

  // Process asynchronously — do not block webhook response
  processEvent(parsedEvent).catch((err) => {
    logger.error('Async processEvent failed', { error: err.message, from: parsedEvent.from });
  });
}

module.exports = { handleWhatsAppWebhook };
