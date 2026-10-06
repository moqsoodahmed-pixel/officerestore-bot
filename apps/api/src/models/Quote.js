'use strict';

const mongoose = require('mongoose');

const quoteItemSchema = new mongoose.Schema({
  lineNumber: { type: Number },
  productId: { type: String },
  productName: { type: String, required: true },
  sku: { type: String },
  categoryKey: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  // Prices are populated by sales team after review — NOT set by bot
  unitPrice: { type: Number },
  totalPrice: { type: Number },
  taxAmount: { type: Number },
  notes: { type: String },
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  quoteId: { type: String, required: true, unique: true, index: true },
  whatsappNumber: { type: String, required: true, index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  leadId: { type: String, index: true },

  // Customer snapshot
  customerName: { type: String },
  companyName: { type: String },

  // Items — populated by bot from conversation
  items: { type: [quoteItemSchema], default: [] },

  // Delivery info
  deliveryPin: { type: String },
  city: { type: String },
  requiredByDate: { type: String },

  // Billing
  billingType: { type: String, enum: ['individual', 'business'] },
  businessName: { type: String },
  gstin: { type: String },

  // Attribution
  source: { type: String },
  campaignId: { type: String },

  // Status lifecycle
  status: {
    type: String,
    enum: [
      'pending_review',   // received from bot, awaiting sales
      'in_review',        // sales reviewing
      'quote_sent',       // formal quote dispatched to customer
      'accepted',         // customer accepted
      'rejected',         // customer rejected
      'expired',          // passed validity
      'cancelled',
    ],
    default: 'pending_review',
    index: true,
  },

  // Set by sales after review (not by bot)
  validUntil: { type: Date },
  totalAmount: { type: Number },
  taxTotal: { type: Number },
  shippingAmount: { type: Number },
  installationAmount: { type: Number },
  currency: { type: String, default: 'INR' },

  assignedTo: { type: String },
  assignedAt: { type: Date },

  // Approved formal quote reference
  formalQuoteRef: { type: String },
  formalQuoteSentAt: { type: Date },

  notes: { type: String },
}, {
  timestamps: true,
});

quoteSchema.index({ status: 1, createdAt: -1 });
quoteSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Quote', quoteSchema);
