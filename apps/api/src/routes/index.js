'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/apiController');
const webhook = require('../controllers/webhookController');
const { requireAdminAuth } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

// ─── Rate limiters ────────────────────────────────────────────────────────────

const webhookLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.webhookMax,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Webhook ──────────────────────────────────────────────────────────────────

router.post('/webhooks/whatsapp', webhookLimiter, webhook.handleWhatsAppWebhook);

// ─── Catalogue (public read) ──────────────────────────────────────────────────

router.get('/api/catalog/categories', apiLimiter, ctrl.getCategories);
router.get('/api/catalog/products', apiLimiter, ctrl.searchProducts);

// ─── Protected admin API ──────────────────────────────────────────────────────

router.use('/api', requireAdminAuth);

// Leads
router.post('/api/leads', apiLimiter, ctrl.createLead);
router.get('/api/leads', apiLimiter, ctrl.getLeads);
router.get('/api/leads/:leadId', apiLimiter, ctrl.getLead);
router.patch('/api/leads/:leadId', apiLimiter, ctrl.updateLead);

// Quotes
router.post('/api/quotes/request', apiLimiter, ctrl.createQuote);
router.get('/api/quotes', apiLimiter, ctrl.getQuotes);
router.get('/api/quotes/:quoteId', apiLimiter, ctrl.getQuote);
router.patch('/api/quotes/:quoteId', apiLimiter, ctrl.updateQuote);

// Tickets
router.post('/api/support/tickets', apiLimiter, ctrl.createTicket);
router.get('/api/support/tickets', apiLimiter, ctrl.getTickets);
router.get('/api/support/tickets/:ticketId', apiLimiter, ctrl.getTicket);
router.patch('/api/support/tickets/:ticketId', apiLimiter, ctrl.updateTicket);

// Orders
router.get('/api/orders/:orderId', apiLimiter, ctrl.lookupOrder);

// Conversations
router.get('/api/conversations', apiLimiter, ctrl.getConversations);
router.post('/api/conversations/:id/takeover', apiLimiter, ctrl.takeoverConversation);
router.post('/api/conversations/:id/release', apiLimiter, ctrl.releaseConversation);

// Messaging
router.post('/api/messages/send', apiLimiter, ctrl.sendMessage);

// Analytics
router.get('/api/dashboard/stats', apiLimiter, ctrl.getDashboardStats);

// Health
router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

module.exports = router;
