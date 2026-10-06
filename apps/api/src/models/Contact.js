'use strict';

const mongoose = require('mongoose');

const attributionSchema = new mongoose.Schema({
  source: { type: String, trim: true },
  landingPage: { type: String, trim: true },
  productUrl: { type: String, trim: true },
  campaignId: { type: String, trim: true },
  referralId: { type: String, trim: true },
  utmSource: { type: String },
  utmMedium: { type: String },
  utmCampaign: { type: String },
}, { _id: false });

const consentSchema = new mongoose.Schema({
  serviceMessageBasis: { type: String, default: 'user_initiated' },
  marketingOptIn: { type: Boolean, default: false },
  marketingOptInAt: { type: Date },
  marketingOptOutAt: { type: Date },
  optOutStatus: { type: Boolean, default: false },
  optOutAt: { type: Date },
  optOutSource: { type: String },
  consentTimestamp: { type: Date, default: Date.now },
  consentSource: { type: String },
}, { _id: false });

const contactSchema = new mongoose.Schema({
  // Normalized E.164 WhatsApp number (primary key for lookups)
  whatsappNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  name: { type: String, trim: true },
  firstName: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  companyName: { type: String, trim: true },
  contactRole: { type: String, trim: true },

  attribution: { type: attributionSchema, default: () => ({}) },
  consent: { type: consentSchema, default: () => ({}) },

  // Analytics counters
  totalConversations: { type: Number, default: 0 },
  totalLeads: { type: Number, default: 0 },
  totalQuotes: { type: Number, default: 0 },

  isBlocked: { type: Boolean, default: false },
  lastSeenAt: { type: Date },
}, {
  timestamps: true,
});

contactSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Contact', contactSchema);
