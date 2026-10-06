'use strict';

const leadsService = require('../services/leads/leadsService');
const quotesService = require('../services/quotes/quotesService');
const ticketsService = require('../services/support/ticketsService');
const catalogueService = require('../services/catalogue/catalogueService');
const orderService = require('../services/orders/orderService');
const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
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
  const { owner, status, page = 1, limit = 20 } = req.query;
  const query = {};
  if (owner) query.owner = owner;
  if (status) query.status = status;

  const [conversations, total] = await Promise.all([
    Conversation.find(query).sort({ lastMessageAt: -1 }).skip((+page - 1) * +limit).limit(+limit).lean(),
    Conversation.countDocuments(query),
  ]);

  res.json({ success: true, conversations, total, page: +page });
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

  await sendText(to, text);
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
  getConversations, releaseConversation, takeoverConversation,
  sendMessage,
  getDashboardStats,
};
