'use strict';

const { sendText, sendButtons } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const leadsService = require('../../services/leads/leadsService');
const catalogueService = require('../../services/catalogue/catalogueService');
const {
  SALES_BTN, MENU_BTN, getInput, setData, getData, resetData,
  handleGlobalButtons, formatProducts, filterProducts, sendAnythingElse,
} = require('./common');

/**
 * Find a Product (spec section 3)
 * Customer describes what they need in their own words. We pull out
 * category, quantity and budget, search the live catalogue, and hand over
 * to sales if there is no reliable match.
 *
 * Phase 1 uses keyword rules. Phase 2 replaces extractRequirement() with AI.
 */

const FLOW = 'find_product';

// Order matters: more specific categories are checked first
const CATEGORY_KEYWORDS = [
  { id: 'cat_conference', label: 'Conference Furniture', words: ['conference', 'meeting table', 'boardroom'] },
  { id: 'cat_reception', label: 'Reception Furniture', words: ['reception', 'front desk', 'waiting area'] },
  { id: 'cat_storage', label: 'Storage', words: ['storage', 'cabinet', 'cabinets', 'locker', 'lockers', 'almirah', 'cupboard', 'pedestal', 'pedestals', 'drawer', 'drawers', 'filing'] },
  { id: 'cat_sofas', label: 'Sofas', words: ['sofa', 'sofas', 'couch', 'lounge'] },
  { id: 'cat_partitions', label: 'Partitions', words: ['partition', 'partitions', 'divider', 'dividers', 'panel', 'panels'] },
  { id: 'cat_workstations', label: 'Workstations', words: ['workstation', 'workstations', 'cubicle', 'cubicles'] },
  { id: 'cat_chairs', label: 'Office Chairs', words: ['chair', 'chairs', 'seating', 'ergonomic', 'mesh'] },
  { id: 'cat_tables', label: 'Office Tables', words: ['table', 'tables', 'desk', 'desks', 'cabin table', 'manager table'] },
];

function hasWord(text, word) {
  // Whole-word match: "cabinet" must not match inside "cabinets" → "cabin"
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z])' + escaped + '([^a-z]|$)', 'i').test(text);
}

function toAmount(num, suffix) {
  let n = parseFloat(String(num).replace(/,/g, ''));
  const s = (suffix || '').toLowerCase();
  if (s === 'k') n *= 1000;
  if (s === 'l' || s.startsWith('lakh') || s.startsWith('lac')) n *= 100000;
  return Math.round(n);
}

/** Pull category, quantity and budget out of free text. */
function extractRequirement(text) {
  let rest = ` ${text.toLowerCase()} `;

  // Budget: "under 3000", "below ₹2,500", "budget 5k", "₹3000 each"
  let budget = null;
  const budgetMatch = rest.match(/(?:under|below|less than|within|upto|up to|budget|max|maximum|around|₹|rs\.?|inr)\s*(?:of\s*)?(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(k|l|lakh|lakhs|lac|lacs)?\b/i);
  if (budgetMatch) {
    budget = toAmount(budgetMatch[1], budgetMatch[2]);
    rest = rest.replace(budgetMatch[0], ' ');
  }
  const perUnit = /\b(each|per piece|per unit|per chair|\/-? ?each|apiece)\b/.test(text.toLowerCase());

  // Quantity: first remaining number
  const qtyMatch = rest.match(/\b(\d{1,4})\b/);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

  // Category
  const cat = CATEGORY_KEYWORDS.find((c) => c.words.some((w) => hasWord(rest, w)));

  return {
    categoryId: cat?.id || null,
    category: cat?.label || null,
    quantity,
    budget,
    budgetPerUnit: budget && (perUnit || (quantity && budget < 100000)) ? budget : null,
  };
}

async function handle(event, conversation, contact) {
  if (await handleGlobalButtons(event, conversation, contact)) return;

  const { from } = event;
  const step = conversation.currentStep;

  if (step === 'initial') {
    resetData(conversation);
    await sendText(from,
      '🔎 *Find a Product*\n\n' +
      'Tell us what you are looking for in your own words.\n\n' +
      '_Example: "I need 20 ergonomic chairs under 3000 each"_');
    await stateManager.transition(conversation, FLOW, 'awaiting_query');
    return;
  }

  if (step === 'awaiting_query') {
    const query = (event.text || '').trim();
    if (query.length < 3) {
      await sendText(from, 'Please describe the product you need, e.g. *"10 mesh chairs under 4000"*.');
      return;
    }
    return search(event, conversation, contact, query);
  }

  if (step === 'results_shown') {
    if (event.interactiveId === 'find_quote') return requestQuote(event, conversation);
    if (event.interactiveId === 'find_again') {
      await stateManager.transition(conversation, FLOW, 'initial');
      return handle(event, conversation, contact);
    }
    // Customer typed a new search
    const query = (event.text || '').trim();
    if (query.length >= 3) return search(event, conversation, contact, query);
    return sendAnythingElse(from);
  }

  if (step === 'done') return sendAnythingElse(from);

  await stateManager.transition(conversation, FLOW, 'initial');
  return handle(event, conversation, contact);
}

async function search(event, conversation, contact, query) {
  const { from } = event;
  const req = extractRequirement(query);
  setData(conversation, { query, ...req });

  const products = filterProducts(
    await catalogueService.searchProducts(query, req.categoryId),
    { budgetPerUnit: req.budgetPerUnit }
  ).slice(0, 5);

  const budgetText = req.budget
    ? `₹${req.budget.toLocaleString('en-IN')}${req.budgetPerUnit ? ' per item' : ''}`
    : undefined;

  const lead = await leadsService.createLead({
    leadType: 'product_enquiry',
    whatsappNumber: from,
    contactId: conversation.contactId,
    customerName: contact.name,
    requirement: query,
    category: req.category || undefined,
    quantity: req.quantity || undefined,
    budget: budgetText,
    items: req.categoryId
      ? [{ categoryKey: req.categoryId, categoryLabel: req.category, quantity: req.quantity || undefined }]
      : [],
    source: conversation.entrySource || 'whatsapp',
    alertReason: 'Find a Product enquiry',
  });
  conversation.currentLeadId = lead.leadId;

  const understood = [
    req.quantity ? `Quantity: ${req.quantity}` : null,
    req.category ? `Category: ${req.category}` : null,
    budgetText ? `Budget: ${budgetText}` : null,
  ].filter(Boolean).join('\n');

  if (products.length) {
    await sendText(from,
      (understood ? `I understood:\n${understood}\n\n` : '') +
      `Here are matching products:\n\n${formatProducts(products)}`);
  } else {
    await sendText(from,
      (understood ? `I understood:\n${understood}\n\n` : '') +
      "I couldn't find a confirmed match in our current stock right now.\n\n" +
      'Our sales team will check availability and share the best options and prices with you.\n\n' +
      `Reference: ${lead.leadId}`);
  }

  await sendButtons(from, {
    body: 'What would you like to do next?',
    buttons: [{ id: 'find_quote', title: 'Request Quote' }, SALES_BTN, { id: 'find_again', title: 'Search Again' }],
  });
  await stateManager.transition(conversation, FLOW, 'results_shown');
}

async function requestQuote(event, conversation) {
  const { from } = event;
  const lead = conversation.currentLeadId
    ? await leadsService.updateLead(conversation.currentLeadId, { quoteRequested: true })
    : null;
  if (lead) await leadsService.notifySales(lead, 'Quotation requested');

  await sendButtons(from, {
    body:
      '✅ *Quote request received!*\n\n' +
      'Our sales team will prepare a quotation and contact you shortly.' +
      (lead ? `\n\nReference: ${lead.leadId}` : ''),
    buttons: [SALES_BTN, MENU_BTN],
  });
  await stateManager.transition(conversation, FLOW, 'done');
}

module.exports = { handle, extractRequirement };