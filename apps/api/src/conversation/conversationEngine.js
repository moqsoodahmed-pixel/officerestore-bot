'use strict';

const stateManager = require('./stateManager');
const flowRouter = require('./flowRouter');
const { detectCommand, handleCommand } = require('./commandHandler');
const Message = require('../models/Message');
const AuditLog = require('../models/AuditLog');
const { sendText, sendButtons } = require('../services/msg91/whatsappService');
const logger = require('../utils/logger');

/**
 * Central conversation engine.
 * Entry point for every inbound WhatsApp event.
 *
 * Responsibilities:
 *  1. Idempotency — reject already-processed messages
 *  2. Load/create conversation state and contact
 *  3. Handle HUMAN ownership (don't auto-reply)
 *  4. Detect and handle global commands (MENU, BACK, HUMAN, STOP, SUPPORT)
 *  5. Route to appropriate flow
 *  6. Log event
 */
async function processEvent(parsedEvent) {
  const { eventId, messageId, from, text, interactiveId, interactiveTitle, senderName, timestamp } = parsedEvent;

  // ── 1. Idempotency check ──────────────────────────────────────────────────
  const existing = await Message.findOne({ providerMessageId: messageId });
  if (existing) {
    logger.warn('Duplicate message — skipping', { messageId, from });
    await AuditLog.create({
      providerMessageId: messageId,
      whatsappNumber: from,
      eventType: 'webhook_duplicate',
      meta: { messageId },
    });
    return;
  }

  // ── 2. Load/create conversation state ─────────────────────────────────────
  const { conversation, contact } = await stateManager.loadOrCreate(from, senderName);

  // ── 3. Record inbound message ─────────────────────────────────────────────
  const msgRecord = await Message.create({
    providerMessageId: messageId,
    whatsappNumber: from,
    conversationId: conversation._id,
    contactId: contact._id,
    direction: 'inbound',
    messageType: parsedEvent.type,
    inboundText: text || interactiveTitle,
    displayText: text || interactiveTitle || (parsedEvent.type ? `[${parsedEvent.type}]` : ''),
    inboundPayload: parsedEvent.raw,
    processed: false,
    flowSnapshot: {
      flow: conversation.currentFlow,
      step: conversation.currentStep,
    },
  });

  await AuditLog.create({
    providerMessageId: messageId,
    whatsappNumber: from,
    contactId: contact._id,
    eventType: 'message_inbound',
    meta: { type: parsedEvent.type },
    flow: conversation.currentFlow,
    step: conversation.currentStep,
  });

  try {
    // ── 4. Check opted-out ────────────────────────────────────────────────
    if (contact.consent?.optOutStatus && parsedEvent.type !== 'text') {
      // Still allow STOP/MENU re-engagement if they message
      logger.info('Message from opted-out contact', { from });
    }

    // ── 5. Handle HUMAN ownership — bot must not auto-reply ───────────────
    if (conversation.owner === 'HUMAN') {
      logger.info('Conversation owned by HUMAN — not auto-replying', { from });
      // Still log the inbound message (agent can see it in dashboard)
      msgRecord.processed = true;
      await msgRecord.save();
      return;
    }

    // ── 6. Detect global commands ─────────────────────────────────────────
    const inputText = text || interactiveTitle || '';
    const command = detectCommand(inputText);

    if (command) {
      await handleCommand(command, parsedEvent, conversation, contact);
      msgRecord.processed = true;
      await msgRecord.save();
      return;
    }

    // ── 7. Also handle interactive IDs that map to menu actions ───────────
    if (interactiveId === 'menu_main' || interactiveId === 'fallback_menu') {
      await handleCommand('MENU', parsedEvent, conversation, contact);
      msgRecord.processed = true;
      await msgRecord.save();
      return;
    }

    if (interactiveId === 'fallback_human' || interactiveId === 'summary_human' ||
        interactiveId === 'comp_human' || interactiveId === 'invoice_human') {
      await handleCommand('HUMAN', parsedEvent, conversation, contact);
      msgRecord.processed = true;
      await msgRecord.save();
      return;
    }

    // ── 8. Route to flow ──────────────────────────────────────────────────
    await flowRouter.route(parsedEvent, conversation, contact);

    msgRecord.processed = true;
    await msgRecord.save();
  } catch (err) {
    logger.error('Error processing event', {
      from,
      flow: conversation.currentFlow,
      step: conversation.currentStep,
      error: err.message,
      stack: err.stack,
    });

    // Customer-friendly fallback — never expose technical errors
    try {
      await sendButtons(from, {
        body: "I'm sorry, something went wrong on our end. Please try again or choose an option:",
        buttons: [
          { id: 'menu_main', title: 'Main Menu' },
          { id: 'fallback_human', title: 'Talk to Team' },
        ],
      });
    } catch (sendErr) {
      logger.error('Failed to send error fallback message', { error: sendErr.message });
    }

    msgRecord.processed = false;
    msgRecord.status = 'failed';
    await msgRecord.save();

    await AuditLog.create({
      providerMessageId: messageId,
      whatsappNumber: from,
      contactId: contact._id,
      eventType: 'error',
      meta: { error: err.message },
      severity: 'error',
    });
  }
}

module.exports = { processEvent };