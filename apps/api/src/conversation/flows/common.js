'use strict';

/**
 * Shared helpers for the spec flows.
 */

const SALES_BTN = { id: 'go_sales', title: 'Talk to Sales' };
const MENU_BTN = { id: 'menu_main', title: 'Main Menu' };
const SKIP_BTN = { id: 'skip', title: 'Skip' };

function buildGreeting(contact = {}) {
  const name = contact.firstName || contact.name || '';
  return `${name ? `Hello ${name}! ` : ''}👋 Welcome to *Officerestore*!\n\n` +
    "Bangalore's destination for quality refurbished office furniture.";
}

/** Text the customer typed, or the title of the button/row they tapped. */
function getInput(event) {
  return (event.text || event.interactiveTitle || '').trim();
}

function isSkip(event) {
  return event.interactiveId === 'skip' || /^skip$/i.test((event.text || '').trim());
}

/** First whole number in a string ("25 chairs" → 25, "2,500" → 2500). */
function parseNumber(text) {
  const m = String(text || '').replace(/,/g, '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/** Merge values into conversation.stepData (a Mixed field). */
function setData(conversation, patch) {
  conversation.stepData = { ...(conversation.stepData || {}), ...patch };
  conversation.markModified('stepData');
}

function getData(conversation) {
  return conversation.stepData || {};
}

function resetData(conversation) {
  conversation.stepData = {};
  conversation.markModified('stepData');
}

/**
 * Buttons that work from any flow. Returns true if handled.
 * (menu_main is already handled by the conversation engine.)
 */
async function handleGlobalButtons(event, conversation, contact) {
  if (event.interactiveId === 'go_sales') {
    const talkToSales = require('./talkToSalesFlow');
    await talkToSales.start(event, conversation, contact);
    return true;
  }
  return false;
}

const TIMELINE_ROWS = [
  { id: 'tl_immediate', title: 'Immediately' },
  { id: 'tl_30', title: 'Within 30 days' },
  { id: 'tl_1_3m', title: 'In 1–3 months' },
  { id: 'tl_later', title: 'Later / Just exploring' },
];

const TIMELINE_LABELS = {
  tl_immediate: 'Immediately',
  tl_30: 'Within 30 days',
  tl_1_3m: '1–3 months',
  tl_later: 'Just exploring',
};

/** Accepts a tapped timeline row, or free text typed by the customer. */
function resolveTimeline(event) {
  if (TIMELINE_LABELS[event.interactiveId]) return TIMELINE_LABELS[event.interactiveId];
  const t = getInput(event);
  return t.length >= 2 ? t : null;
}

/**
 * Format products from the live catalogue. Only shows values that exist in
 * the data — never invents price, stock or specs (spec section 7).
 */
function formatProducts(products) {
  return products.map((p, i) => {
    const name = p.name || p.title || 'Product';
    const lines = [`*${i + 1}. ${name}*`];
    const price = p.price ?? p.salePrice ?? p.sale_price;
    lines.push(price ? `Price: ₹${Number(price).toLocaleString('en-IN')}` : 'Price: our sales team will confirm');
    const stock = p.quantityAvailable ?? p.stockQuantity ?? p.stock_quantity ?? p.quantity;
    if (stock !== undefined && stock !== null) lines.push(`Available: ${stock}`);
    if (p.condition) lines.push(`Condition: ${p.condition}`);
    const sku = p.sku || p.id;
    if (sku) lines.push(`SKU: ${sku}`);
    const url = p.url || p.permalink || p.productUrl;
    if (url) lines.push(url);
    return lines.join('\n');
  }).join('\n\n');
}

/** Drop inactive / out-of-stock products and those over budget. */
function filterProducts(products, { budgetPerUnit } = {}) {
  return (products || []).filter((p) => {
    if (p.active === false || p.status === 'inactive' || p.status === 'draft') return false;
    const stock = p.quantityAvailable ?? p.stockQuantity ?? p.stock_quantity ?? p.quantity;
    if (stock !== undefined && stock !== null && Number(stock) <= 0) return false;
    if (p.inStock === false || p.stock_status === 'outofstock') return false;
    const price = Number(p.price ?? p.salePrice ?? p.sale_price);
    if (budgetPerUnit && price && price > budgetPerUnit) return false;
    return true;
  });
}

/** Shown when a flow is finished and the customer types again. */
async function sendAnythingElse(from) {
  const { sendButtons } = require('../../services/msg91/whatsappService');
  await sendButtons(from, {
    body: 'Is there anything else we can help you with?',
    buttons: [SALES_BTN, MENU_BTN],
  });
}

module.exports = {
  sendAnythingElse,
  SALES_BTN, MENU_BTN, SKIP_BTN,
  buildGreeting, getInput, isSkip, parseNumber,
  setData, getData, resetData, handleGlobalButtons,
  TIMELINE_ROWS, resolveTimeline,
  formatProducts, filterProducts,
};