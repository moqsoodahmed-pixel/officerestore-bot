'use strict';

const mongoose = require('mongoose');

const leadItemSchema = new mongoose.Schema({
  categoryKey: { type: String },
  categoryLabel: { type: String },
  productId: { type: String },
  productName: { type: String },
  sku: { type: String },
  quantity: { type: Number },
  notes: { type: String },
}, { _id: false });

const leadSchema = new mongoose.Schema({
  leadId: { type: String, required: true, unique: true, index: true },
  whatsappNumber: { type: String, required: true, index: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },

  leadType: {
    type: String,
    enum: ['product_enquiry', 'bulk_office', 'quote_request', 'support', 'general'],
    required: true,
    index: true,
  },

  // Contact info snapshot
  customerName: { type: String },
  companyName: { type: String },
  contactRole: { type: String },

  // Requirement details
  items: { type: [leadItemSchema], default: [] },
  seats: { type: Number },
  deliveryPin: { type: String, index: true },
  city: { type: String },
  timeline: { type: String },
  budget: { type: String },
  specialRequirements: { type: String },
  installationRequired: { type: Boolean },
  businessType: { type: String },

  // Attribution
  source: { type: String, index: true },
  entryProductUrl: { type: String },
  campaignId: { type: String },

  status: {
    type: String,
    enum: ['new', 'assigned', 'in_progress', 'quoted', 'converted', 'lost', 'cancelled'],
    default: 'new',
    index: true,
  },
  assignedTo: { type: String },
  assignedAt: { type: Date },

  // Internal notes
  notes: { type: String },
  crmLeadId: { type: String },
}, {
  timestamps: true,
});

leadSchema.index({ createdAt: -1 });
leadSchema.index({ status: 1, leadType: 1 });

module.exports = mongoose.model('Lead', leadSchema);
