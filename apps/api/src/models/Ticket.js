'use strict';

const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true, index: true },
  whatsappNumber: { type: String, required: true, index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },

  category: {
    type: String,
    enum: [
      'damaged_item', 'wrong_item', 'missing_item',
      'return_cancellation', 'warranty', 'invoice',
      'delivery', 'payment', 'general_complaint', 'other',
    ],
    required: true,
    index: true,
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },

  // Related order/product
  orderRef: { type: String, index: true },
  productName: { type: String },
  sku: { type: String },

  summary: { type: String },
  description: { type: String },

  // Attachments are stored as references to external/approved channels
  attachmentRefs: { type: [String], default: [] },

  status: {
    type: String,
    enum: ['open', 'in_review', 'pending_customer', 'resolved', 'closed', 'cancelled'],
    default: 'open',
    index: true,
  },

  assignedTo: { type: String },
  assignedAt: { type: Date },

  // Resolution — set by team, NOT by bot
  resolution: { type: String },
  resolvedAt: { type: Date },
  closedAt: { type: Date },

  // CRM/helpdesk reference
  externalTicketId: { type: String },

  // Audit trail entries
  timeline: {
    type: [{
      at: { type: Date, default: Date.now },
      actor: { type: String },
      action: { type: String },
      note: { type: String },
    }],
    default: [],
  },
}, {
  timestamps: true,
});

ticketSchema.index({ status: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
