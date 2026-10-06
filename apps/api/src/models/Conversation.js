'use strict';

const mongoose = require('mongoose');

// Tracks one selected product/category with quantity during multi-select flow
const selectedItemSchema = new mongoose.Schema({
  categoryKey: { type: String },
  categoryLabel: { type: String },
  productId: { type: String },
  productName: { type: String },
  sku: { type: String },
  quantity: { type: Number },
  notes: { type: String },
}, { _id: false });

// Bulk enquiry data collected step-by-step
const bulkEnquirySchema = new mongoose.Schema({
  companyName: { type: String },
  contactName: { type: String },
  seats: { type: Number },
  deliveryPin: { type: String },
  city: { type: String },
  timeline: { type: String },
  budget: { type: String },
  specialRequirements: { type: String },
  finishRequirements: { type: String },
  installationRequired: { type: Boolean },
}, { _id: false });

// Quote collection data
const quoteDataSchema = new mongoose.Schema({
  billingType: { type: String, enum: ['individual', 'business'] },
  deliveryPin: { type: String },
  requiredByDate: { type: String },
  businessName: { type: String },
  gstin: { type: String },
}, { _id: false });

// Delivery/installation query data
const deliveryQuerySchema = new mongoose.Schema({
  subType: { type: String },
  deliveryPin: { type: String },
  city: { type: String },
  orderRef: { type: String },
}, { _id: false });

// Order tracking data
const orderTrackingSchema = new mongoose.Schema({
  orderRef: { type: String },
  verificationMethod: { type: String },
  verified: { type: Boolean, default: false },
}, { _id: false });

// Support/complaint data
const supportDataSchema = new mongoose.Schema({
  issueCategory: { type: String },
  orderRef: { type: String },
  productName: { type: String },
  issueDescription: { type: String },
  attachmentRef: { type: String },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  // Indexed lookup key
  whatsappNumber: { type: String, required: true, unique: true, index: true },

  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },

  // State machine
  currentFlow: {
    type: String,
    enum: [
      'welcome', 'browse_products', 'bulk_enquiry', 'quote',
      'pricing', 'delivery', 'order_tracking', 'invoice',
      'complaint', 'support', 'human_handoff', 'idle',
    ],
    default: 'idle',
  },
  currentStep: { type: String, default: 'initial' },
  previousFlow: { type: String },
  previousStep: { type: String },

  // Conversation ownership
  owner: { type: String, enum: ['BOT', 'HUMAN'], default: 'BOT' },
  assignedAgentId: { type: String },
  humanTookOverAt: { type: Date },

  // Multi-selection state (survives across turns)
  selectedCategories: { type: [String], default: [] },
  selectedItems: { type: [selectedItemSchema], default: [] },
  currentSelectionStep: { type: String }, // which sub-step within multi-select

  // Flow-specific collected data
  bulkEnquiry: { type: bulkEnquirySchema },
  quoteData: { type: quoteDataSchema },
  deliveryQuery: { type: deliveryQuerySchema },
  orderTracking: { type: orderTrackingSchema },
  supportData: { type: supportDataSchema },

  // Generic key-value store for transient step data
  stepData: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Linked records
  currentLeadId: { type: String },
  currentQuoteId: { type: String },
  currentTicketId: { type: String },

  // Context from CTA / entry link
  entrySource: { type: String },
  entryProductUrl: { type: String },
  entryCampaignId: { type: String },

  status: {
    type: String,
    enum: ['active', 'idle', 'completed', 'timed_out', 'opted_out'],
    default: 'active',
    index: true,
  },
  lastMessageAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ status: 1, owner: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
