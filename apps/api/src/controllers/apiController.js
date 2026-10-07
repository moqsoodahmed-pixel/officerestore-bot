'use strict';

const leadsService = require('../services/leads/leadsService');
const quotesService = require('../services/quotes/quotesService');
const ticketsService = require('../services/support/ticketsService');
const catalogueService = require('../services/catalogue/catalogueService');
const orderService = require('../services/orders/orderService');
const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const AuditLog = require('../models/AuditLog');
const stateManager = require('../conversation/stateManager');
const { sendText } = require('../services/msg91/whatsappService');
const logger = require('../utils/logger');

// ─── Leads ────────────────────────────────────────────────────────────────────

async function createLead(req, res) {
  const lead = await leadsService.createLead(req.body);
  res.status(201).json({ success: true, data: lead });
}

async function getLeads(req, res) {
  const { status, leadType, deliveryPin, page = 1, limit = 20 } = req.query;
  const result = await leadsService.getLeads({ status, leadType, deliveryPin }, +page, +limit);
  res.json({ success: true, ...result });
}

async function getLead(req, res) {
  const lead = await leadsService.getLead(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  res.json({ success: true, data: lead });
}

async function updateLead(req, res) {
  const lead = await leadsService.updateLead(req.params.leadId, req.body);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  res.json({ success: true, data: lead });
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

async function createQuote(req, res) {
  const quote = await quotesService.createQuoteRequest(req.body);
  res.status(201).json({ success: true, data: quote });
}

async function getQuotes(req, res) {
  const { status, assignedTo, page = 1, limit = 20 } = req.query;
  const result = await quotesService.getQuotes({ status, assignedTo }, +page, +limit);
  res.json({ success: true, ...result });
}

async function getQuote(req, res) {
  const quote = await quotesService.getQuote(req.params.quoteId);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
  res.json({ success: true, data: quote });
}

async function updateQuote(req, res) {
  const quote = await quotesService.updateQuote(req.params.quoteId, req.body);
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
  res.json({ success: true, data: quote });
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

async function createTicket(req, res) {
  const ticket = await ticketsService.createTicket(req.body);
  res.status(201).json({ success: true, data: ticket });
}

async function getTickets(req, res) {
  const { status, category, page = 1, limit = 20 } = req.query;
  const result = await ticketsService.getTickets({ status, category }, +page, +limit);
  res.json({ success: true, ...result });
}

async function getTicket(req, res) {
  const ticket = await ticketsService.getTicket(req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
  res.json({ success: true, data: ticket });
}

async function updateTicket(req, res) {
  const ticket = await ticketsService.updateTicket(req.params.ticketId, req.body, 'admin');
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
  res.json({ success: true, data: ticket });
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

async function getCategories(req, res) {
  const categories = await catalogueService.getCategories();
  res.json({ success: true, data: categories });
}

async function searchProducts(req, res) {
  const { q, category } = req.query;
  const products = await catalogueService.searchProducts(q, category);
  res.json({ success: true, data: products });
}

// ─── Orders ───────────────────────────────────────────────────────────────────

async function lookupOrder(req, res) {
  // Admin endpoint — requires auth (see middleware)
  const { orderId } = req.params;
  const order = await orderService.lookupOrder(orderId, null);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
  res.json({ success: true, data: order });
}

// ─── Conversations (admin) ────────────────────────────────────────────────────

async function getConversations(req, res) {
  const { owner, status, search, page = 1, limit = 20 } = req.query;
  const query = {};
  if (owner) query.owner = owner;
  if (status) query.status = status;

  // Search by number or customer name
  if (search && search.trim()) {
    const term = search.trim();
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const contacts = await Contact.find({ name: { $regex: escaped, $options: 'i' } }, { whatsappNumber: 1 }).lean();
    query.$or = [
      { whatsappNumber: { $regex: term.replace(/\D/g, '') || escaped } },
      { whatsappNumber: { $in: contacts.map((c) => c.whatsappNumber) } },
    ];
  }

  const [conversations, total] = await Promise.all([
    Conversation.find(query).sort({ lastMessageAt: -1 }).skip((+page - 1) * +limit).limit(+limit).lean(),
    Conversation.countDocuments(query),
  ]);

  // Attach customer name + last message preview
  const numbers = conversations.map((c) => c.whatsappNumber);
  const [contacts, lastMessages] = await Promise.all([
    Contact.find({ whatsappNumber: { $in: numbers } }, { whatsappNumber: 1, name: 1, companyName: 1 }).lean(),
    Message.aggregate([
      { $match: { whatsappNumber: { $in: numbers } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$whatsappNumber', text: { $first: '$displayText' }, direction: { $first: '$direction' }, at: { $first: '$createdAt' } } },
    ]),
  ]);
  const contactMap = Object.fromEntries(contacts.map((c) => [c.whatsappNumber, c]));
  const lastMap = Object.fromEntries(lastMessages.map((m) => [m._id, m]));

  const enriched = conversations.map((c) => ({
    ...c,
    customerName: contactMap[c.whatsappNumber]?.name || null,
    companyName: contactMap[c.whatsappNumber]?.companyName || null,
    lastMessage: lastMap[c.whatsappNumber] || null,
  }));

  res.json({ success: true, conversations: enriched, total, page: +page });
}

/**
 * Full message history for one conversation (oldest first).
 */
async function getConversationMessages(req, res) {
  const conversation = await Conversation.findById(req.params.id).lean();
  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

  const limit = Math.min(+req.query.limit || 300, 1000);
  const messages = await Message.find(
    { whatsappNumber: conversation.whatsappNumber },
    { direction: 1, messageType: 1, displayText: 1, inboundText: 1, options: 1, sentBy: 1, status: 1, failureReason: 1, createdAt: 1 }
  ).sort({ createdAt: -1 }).limit(limit).lean();

  const contact = await Contact.findOne({ whatsappNumber: conversation.whatsappNumber }).lean();
  const leads = await require('../models/Lead')
    .find({ whatsappNumber: conversation.whatsappNumber })
    .sort({ createdAt: -1 }).limit(10).lean();

  res.json({
    success: true,
    conversation,
    contact,
    leads,
    messages: messages.reverse().map((m) => ({
      ...m,
      displayText: m.displayText || m.inboundText || (m.messageType ? `[${m.messageType}]` : ''),
    })),
  });
}

/**
 * Release a conversation from HUMAN back to BOT.
 */
async function releaseConversation(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

  await stateManager.setBotOwner(conversation);

  await AuditLog.create({
    whatsappNumber: conversation.whatsappNumber,
    eventType: 'bot_resumed',
    meta: { releasedBy: req.admin?.id || 'admin' },
  });

  res.json({ success: true, message: 'Conversation released to BOT' });
}

/**
 * Take over a conversation (human agent).
 */
async function takeoverConversation(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

  await stateManager.setHumanOwner(conversation, req.body.agentId || 'admin');

  await AuditLog.create({
    whatsappNumber: conversation.whatsappNumber,
    eventType: 'human_takeover',
    meta: { agentId: req.body.agentId || 'admin' },
  });

  res.json({ success: true, message: 'Conversation taken over by human agent' });
}

// ─── Send message (admin/agent) ───────────────────────────────────────────────

async function sendMessage(req, res) {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ success: false, message: 'to and text are required' });

  await sendText(to, text, { sentBy: 'agent' });
  res.json({ success: true, message: 'Message sent' });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

async function getDashboardStats(req, res) {
  const [
    totalConversations,
    activeConversations,
    humanConversations,
    totalLeads,
    totalQuotes,
    totalTickets,
    optOuts,
  ] = await Promise.all([
    Conversation.countDocuments(),
    Conversation.countDocuments({ status: 'active' }),
    Conversation.countDocuments({ owner: 'HUMAN' }),
    require('../models/Lead').countDocuments(),
    require('../models/Quote').countDocuments(),
    require('../models/Ticket').countDocuments(),
    Contact.countDocuments({ 'consent.optOutStatus': true }),
  ]);

  res.json({
    success: true,
    stats: {
      conversations: { total: totalConversations, active: activeConversations, human: humanConversations },
      leads: totalLeads,
      quotes: totalQuotes,
      tickets: totalTickets,
      optOuts,
    },
  });
}

module.exports = {
  createLead, getLeads, getLead, updateLead,
  createQuote, getQuotes, getQuote, updateQuote,
  createTicket, getTickets, getTicket, updateTicket,
  getCategories, searchProducts,
  lookupOrder,
  getConversations, getConversationMessages, releaseConversation, takeoverConversation,
  sendMessage,
  getDashboardStats,
};