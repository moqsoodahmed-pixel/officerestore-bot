'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Provider-side event/message IDs (for idempotency)
  providerEventId: { type: String, index: true },
  providerMessageId: { type: String, index: true },

  whatsappNumber: { type: String, index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },

  eventType: {
    type: String,
    enum: [
      'webhook_received', 'webhook_duplicate', 'webhook_invalid',
      'message_inbound', 'message_outbound', 'message_delivered',
      'message_read', 'message_failed',
      'lead_created', 'lead_updated',
      'quote_created', 'quote_updated',
      'ticket_created', 'ticket_updated',
      'conversation_started', 'conversation_state_change',
      'human_takeover', 'bot_resumed',
      'opt_out', 'opt_in',
      'sales_alert',
      'order_lookup', 'order_lookup_failed',
      'auth_success', 'auth_failure',
      'error', 'rate_limited',
    ],
    required: true,
    index: true,
  },

  // Minimal structured context — no sensitive PII/credentials
  meta: { type: mongoose.Schema.Types.Mixed },

  // Current flow/step
  flow: { type: String },
  step: { type: String },

  // References
  leadId: { type: String, index: true },
  quoteId: { type: String, index: true },
  ticketId: { type: String, index: true },
  orderId: { type: String, index: true },

  severity: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
}, {
  timestamps: true,
});

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);