'use strict';

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Provider's message ID (used for deduplication — unique index)
  providerMessageId: { type: String, required: true, unique: true, index: true },

  whatsappNumber: { type: String, required: true, index: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },

  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  // Any WhatsApp type: text, interactive, button, list, image, location, ...
  messageType: { type: String, default: 'text' },

  // Readable text for the dashboard chat view
  displayText: { type: String },
  // Buttons / list rows offered in an outbound message
  options: { type: [String], default: [] },
  // Who sent an outbound message: bot | agent | alert
  sentBy: { type: String },

  // Inbound: raw text or interactive selection
  inboundText: { type: String },
  inboundPayload: { type: mongoose.Schema.Types.Mixed },

  // Outbound: what we sent
  outboundTemplate: { type: String },
  outboundPayload: { type: mongoose.Schema.Types.Mixed },

  // Delivery status
  status: {
    type: String,
    enum: ['received', 'sent', 'delivered', 'read', 'failed'],
    default: 'received',
  },
  failureReason: { type: String },

  // Processing state (idempotency)
  processed: { type: Boolean, default: false, index: true },
  processedAt: { type: Date },

  // Flow snapshot at time of message
  flowSnapshot: {
    flow: { type: String },
    step: { type: String },
  },
}, {
  timestamps: true,
});

messageSchema.index({ whatsappNumber: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);