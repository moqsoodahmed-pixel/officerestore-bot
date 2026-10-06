'use strict';

const Quote = require('../../models/Quote');
const AuditLog = require('../../models/AuditLog');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

function generateQuoteId() {
  return `QUO-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
}

async function createQuoteRequest(data) {
  const quoteId = generateQuoteId();

  const items = (data.items || []).map((item, i) => ({
    lineNumber: i + 1,
    categoryKey: item.categoryKey,
    productName: item.categoryLabel || item.productName || 'Unknown Product',
    sku: item.sku,
    quantity: item.quantity || 1,
    notes: item.notes,
  }));

  const quote = await Quote.create({
    quoteId,
    whatsappNumber: data.whatsappNumber,
    contactId: data.contactId,
    customerName: data.customerName,
    companyName: data.companyName,
    items,
    deliveryPin: data.quoteData?.deliveryPin,
    billingType: data.quoteData?.billingType,
    requiredByDate: data.quoteData?.requiredByDate,
    businessName: data.quoteData?.businessName,
    gstin: data.quoteData?.gstin,
    source: data.source || 'whatsapp',
    campaignId: data.campaignId,
    status: 'pending_review',
  });

  await AuditLog.create({
    whatsappNumber: data.whatsappNumber,
    contactId: data.contactId,
    eventType: 'quote_created',
    meta: { quoteId, itemCount: items.length },
    quoteId,
  });

  logger.info('Quote request created', { quoteId, items: items.length });
  return quote;
}

async function updateQuote(quoteId, updates) {
  const quote = await Quote.findOneAndUpdate(
    { quoteId },
    { $set: updates },
    { new: true }
  );
  if (quote) {
    await AuditLog.create({
      whatsappNumber: quote.whatsappNumber,
      eventType: 'quote_updated',
      meta: { quoteId, updates: Object.keys(updates) },
      quoteId,
    });
  }
  return quote;
}

async function getQuotes(filters = {}, page = 1, limit = 20) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.assignedTo) query.assignedTo = filters.assignedTo;

  const [quotes, total] = await Promise.all([
    Quote.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Quote.countDocuments(query),
  ]);

  return { quotes, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getQuote(quoteId) {
  return Quote.findOne({ quoteId }).lean();
}

module.exports = { createQuoteRequest, updateQuote, getQuotes, getQuote };
