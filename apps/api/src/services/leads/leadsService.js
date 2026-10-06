'use strict';

const Lead = require('../../models/Lead');
const AuditLog = require('../../models/AuditLog');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const { scoreLead } = require('./leadScoring');
const { notifySales } = require('./salesNotifier');

function generateLeadId() {
  return `LEAD-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
}

const LEAD_FIELDS = [
  'whatsappNumber', 'contactId', 'leadType', 'customerName', 'companyName',
  'contactRole', 'items', 'seats', 'deliveryPin', 'city', 'timeline', 'budget',
  'specialRequirements', 'installationRequired', 'source', 'entryProductUrl',
  'campaignId', 'notes',
  // spec fields
  'contactPhone', 'requirement', 'category', 'quantity', 'location', 'teamSize',
  'quoteRequested', 'priority', 'followUpAt', 'handoverRequested',
];

function pick(data) {
  const out = {};
  for (const key of LEAD_FIELDS) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') out[key] = data[key];
  }
  return out;
}

/**
 * Create a new lead. The lead score is calculated automatically.
 * HOT leads trigger a sales alert unless data.notify === false.
 * data.alertReason is included in the alert message.
 */
async function createLead(data) {
  const leadId = generateLeadId();
  const fields = pick(data);
  fields.leadType = fields.leadType || 'general';
  fields.source = fields.source || 'whatsapp';
  fields.leadScore = scoreLead(fields);

  const lead = await Lead.create({ leadId, status: 'new', ...fields });

  await AuditLog.create({
    whatsappNumber: data.whatsappNumber,
    contactId: data.contactId,
    eventType: 'lead_created',
    meta: { leadId, leadType: fields.leadType, leadScore: fields.leadScore },
    leadId,
  });

  logger.info('Lead created', { leadId, leadType: fields.leadType, leadScore: fields.leadScore });

  if (lead.leadScore === 'HOT' && data.notify !== false) {
    await notifySales(lead, data.alertReason || 'High-intent lead');
  }

  return lead;
}

/**
 * Update a lead and recalculate its score.
 */
async function updateLead(leadId, updates) {
  const lead = await Lead.findOne({ leadId });
  if (!lead) return null;

  Object.assign(lead, updates);
  lead.leadScore = scoreLead(lead.toObject());
  await lead.save();

  await AuditLog.create({
    whatsappNumber: lead.whatsappNumber,
    eventType: 'lead_updated',
    meta: { leadId, updates: Object.keys(updates), leadScore: lead.leadScore },
    leadId,
  });

  return lead;
}

async function getLeads(filters = {}, page = 1, limit = 20) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.leadType) query.leadType = filters.leadType;
  if (filters.deliveryPin) query.deliveryPin = filters.deliveryPin;
  if (filters.leadScore) query.leadScore = filters.leadScore;

  const [leads, total] = await Promise.all([
    Lead.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Lead.countDocuments(query),
  ]);

  return { leads, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getLead(leadId) {
  return Lead.findOne({ leadId }).lean();
}

module.exports = { createLead, updateLead, getLeads, getLead, notifySales };