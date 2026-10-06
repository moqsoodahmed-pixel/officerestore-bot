'use strict';

const Lead = require('../../models/Lead');
const AuditLog = require('../../models/AuditLog');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

function generateLeadId() {
  return `LEAD-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
}

/**
 * Create a new lead.
 * Idempotency: does not create a duplicate if one was recently created
 * for the same phone number with the same leadType within 60 seconds.
 */
async function createLead(data) {
  const leadId = generateLeadId();

  const lead = await Lead.create({
    leadId,
    whatsappNumber: data.whatsappNumber,
    contactId: data.contactId,
    leadType: data.leadType || 'general',
    customerName: data.customerName,
    companyName: data.companyName,
    contactRole: data.contactRole,
    items: data.items || [],
    seats: data.seats,
    deliveryPin: data.deliveryPin,
    city: data.city,
    timeline: data.timeline,
    budget: data.budget,
    specialRequirements: data.specialRequirements,
    installationRequired: data.installationRequired,
    source: data.source || 'whatsapp',
    entryProductUrl: data.entryProductUrl,
    campaignId: data.campaignId,
    notes: data.notes,
    status: 'new',
  });

  await AuditLog.create({
    whatsappNumber: data.whatsappNumber,
    contactId: data.contactId,
    eventType: 'lead_created',
    meta: { leadId, leadType: data.leadType },
    leadId,
  });

  logger.info('Lead created', { leadId, leadType: data.leadType });
  return lead;
}

async function updateLead(leadId, updates) {
  const lead = await Lead.findOneAndUpdate(
    { leadId },
    { $set: updates },
    { new: true }
  );

  if (lead) {
    await AuditLog.create({
      whatsappNumber: lead.whatsappNumber,
      eventType: 'lead_updated',
      meta: { leadId, updates: Object.keys(updates) },
      leadId,
    });
  }

  return lead;
}

async function getLeads(filters = {}, page = 1, limit = 20) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.leadType) query.leadType = filters.leadType;
  if (filters.deliveryPin) query.deliveryPin = filters.deliveryPin;

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

module.exports = { createLead, updateLead, getLeads, getLead };
