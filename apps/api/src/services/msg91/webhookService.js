'use strict';

const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Validate an incoming MSG91 webhook.
 *
 * MSG91 "Custom Webhook" cannot compute an HMAC signature, so we use a
 * shared secret sent as a static header (added in MSG91 → Webhook → Headers):
 *
 *     x-webhook-secret: <same value as MSG91_WEBHOOK_SECRET>
 *
 * HMAC (X-Hub-Signature-256: sha256=...) is still supported as a fallback.
 * If MSG91_WEBHOOK_SECRET is not set, validation is skipped (mock mode).
 */
function validateWebhookSignature(rawBody, headers = {}) {
  const secret = config.msg91.webhookSecret;

  if (!secret || secret === 'mock_webhook_secret') {
    logger.warn('Webhook validation skipped (no MSG91_WEBHOOK_SECRET set)');
    return true;
  }

  const safeEqual = (a, b) => {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  };

  // 1. Shared-secret header (what MSG91 Custom Webhook can send)
  const sharedSecret = headers['x-webhook-secret'];
  if (sharedSecret) return safeEqual(sharedSecret, secret);

  // 2. HMAC fallback
  const signature = headers['x-hub-signature-256'] || headers['x-msg91-signature'];
  if (signature && rawBody) {
    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;
    return safeEqual(signature, expected);
  }

  logger.warn('Missing webhook secret/signature header');
  return false;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

// MSG91 leaves unfilled placeholders like "{{text}}" or empty strings.
function clean(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v || v === 'null' || v === 'undefined' || /^\{\{.*\}\}$/.test(v)) return null;
    return v;
  }
  return value;
}

// MSG91 often sends nested objects as JSON strings. Parse if possible.
function maybeJson(value) {
  const v = clean(value);
  if (typeof v !== 'string') return v;
  if (!/^[[{]/.test(v)) return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function toDate(ts) {
  const v = clean(ts);
  if (!v) return new Date();
  if (/^\d+$/.test(String(v))) {
    const n = Number(v);
    return new Date(n < 1e12 ? n * 1000 : n); // seconds or milliseconds
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Pull id/title out of a WhatsApp interactive object (list or button reply).
function readInteractive(interactive) {
  if (!interactive || typeof interactive !== 'object') return {};
  const reply =
    interactive.list_reply ||
    interactive.button_reply ||
    interactive.nfm_reply ||
    null;
  return {
    interactiveType: interactive.type || (interactive.list_reply ? 'list_reply' : 'button_reply'),
    interactiveId: reply?.id || interactive.id || null,
    interactiveTitle: reply?.title || interactive.title || null,
  };
}

/* ─── MSG91 flat payload (Custom Webhook) ──────────────────────────────── */

function parseMsg91Flat(body) {
  const from = clean(body.customerNumber);
  if (!from) return null;

  // Ignore delivery/status/failure webhooks — only handle real inbound messages
  const direction = String(clean(body.direction) || '').toLowerCase();
  if (direction && direction !== 'inbound' && direction !== '0') return null;

  // MSG91 may also send the raw WhatsApp message(s) in "messages"
  let rawMsg = maybeJson(body.messages);
  if (Array.isArray(rawMsg)) rawMsg = rawMsg[0];
  if (rawMsg && typeof rawMsg !== 'object') rawMsg = null;

  const type = String(
    clean(body.contentType) || clean(body.messageType) || rawMsg?.type || 'text'
  ).toLowerCase();

  let text = null;
  let interactiveId = null;
  let interactiveTitle = null;
  let interactiveType = null;

  if (type === 'text') {
    const t = maybeJson(body.text) ?? rawMsg?.text;
    text = typeof t === 'object' ? clean(t?.body) : clean(t);
  } else if (type === 'interactive') {
    const inter = maybeJson(body.interactive) || rawMsg?.interactive;
    ({ interactiveId, interactiveTitle, interactiveType } = readInteractive(inter));
  } else if (type === 'button') {
    // Quick-reply button on a template message
    const btn = maybeJson(body.button) || rawMsg?.button;
    interactiveType = 'button';
    if (btn && typeof btn === 'object') {
      interactiveId = btn.payload || btn.id || null;
      interactiveTitle = btn.text || btn.title || null;
    } else {
      interactiveTitle = clean(btn);
    }
  } else if (['image', 'document', 'audio', 'video', 'sticker'].includes(type)) {
    text = clean(body.caption) || `[${type} received]`;
  } else if (type === 'location') {
    text = `[location ${clean(body.latitude) || ''},${clean(body.longitude) || ''}]`;
  } else {
    // Unknown type: fall back to whatever text exists
    const t = maybeJson(body.text);
    text = typeof t === 'object' ? clean(t?.body) : clean(t);
  }

  const eventId =
    clean(body.uuid) ||
    rawMsg?.id ||
    clean(body.requestId) ||
    clean(body.crqid) ||
    `msg91-${from}-${clean(body.ts) || Date.now()}`;

  return {
    eventId,
    messageId: eventId,
    from: String(from).replace(/\D/g, ''),
    type,
    timestamp: toDate(body.ts || body.requestedAt),
    senderName: clean(body.customerName),
    text,
    interactiveId,
    interactiveTitle,
    interactiveType,
    raw: body,
  };
}

/* ─── Legacy / Meta-style payload ({ data: { from, type, ... } }) ─────── */

function parseLegacy(body) {
  const data = body?.data || body;
  if (!data || !data.from) return null;

  const type = data.type;
  let text = null;
  let interactiveId = null;
  let interactiveTitle = null;
  let interactiveType = null;

  if (type === 'text') {
    text = data.text?.body?.trim() || null;
  } else if (type === 'interactive') {
    ({ interactiveId, interactiveTitle, interactiveType } = readInteractive(data.interactive));
  } else if (['image', 'document', 'audio', 'video'].includes(type)) {
    text = `[${type} received]`;
  }

  const eventId = data.id || `unknown-${Date.now()}`;
  return {
    eventId,
    messageId: eventId,
    from: String(data.from).replace(/\D/g, ''),
    type,
    timestamp: data.timestamp ? new Date(data.timestamp * 1000) : new Date(),
    senderName: data.contacts?.[0]?.profile?.name || null,
    text,
    interactiveId,
    interactiveTitle,
    interactiveType,
    raw: data,
  };
}

/**
 * Parse a raw webhook payload into a normalized event object.
 * Returns null if the payload is unrecognized or not actionable.
 */
function parseWebhookEvent(body) {
  try {
    if (!body || typeof body !== 'object') return null;
    const event = 'customerNumber' in body ? parseMsg91Flat(body) : parseLegacy(body);
    if (event && !event.text && !event.interactiveId && !event.interactiveTitle) {
      logger.warn('Webhook event has no usable content', { type: event.type, from: event.from });
    }
    return event;
  } catch (err) {
    logger.error('Failed to parse webhook event', { error: err.message });
    return null;
  }
}

module.exports = { validateWebhookSignature, parseWebhookEvent };