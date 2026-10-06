'use strict';

const { sendMainMenu, sendText, sendButtons } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const flowRouter = require('../flowRouter');

/**
 * Welcome Flow — handles main menu and routes to sub-flows.
 */
async function handle(event, conversation, contact) {
  const { from } = event;
  const step = conversation.currentStep;
  const id = event.interactiveId || '';
  const text = (event.text || '').trim();

  // ── Initial welcome ────────────────────────────────────────────────────────
  if (step === 'initial' || step === 'main_menu') {
    const firstName = contact.firstName || contact.name || '';
    const greeting = firstName
      ? `Hello ${firstName}! 👋 Welcome to *Officerestore*.\n\nWe help you find office furniture and workplace essentials for your business or workspace.`
      : '👋 Welcome to *Officerestore*.\n\nWe help you find office furniture and workplace essentials for your business or workspace.';

    await sendMainMenu(from, greeting);
    await stateManager.transition(conversation, 'welcome', 'awaiting_menu_selection');
    return;
  }

  // ── Handle main menu selection ─────────────────────────────────────────────
  if (step === 'awaiting_menu_selection') {
    return handleMenuSelection(id, text, event, conversation, contact);
  }

  // Fallback: re-show main menu
  await sendMainMenu(from);
  await stateManager.transition(conversation, 'welcome', 'awaiting_menu_selection');
}

async function handleMenuSelection(id, text, event, conversation, contact) {
  const { from } = event;

  // Map selection ID to flow
  const routeMap = {
    menu_browse: ['browse_products', 'initial'],
    menu_bulk: ['bulk_enquiry', 'initial'],
    menu_quote: ['quote', 'initial'],
    menu_pricing: ['pricing', 'initial'],
    menu_delivery: ['delivery', 'initial'],
    menu_track: ['order_tracking', 'initial'],
    menu_invoice: ['invoice', 'initial'],
    menu_complaint: ['complaint', 'initial'],
    menu_support: ['support', 'initial'],
  };

  // Also handle numeric text fallback (e.g. user types "1" instead of tapping)
  const textToId = {
    '1': 'menu_browse', '2': 'menu_bulk', '3': 'menu_quote',
    '4': 'menu_pricing', '5': 'menu_delivery', '6': 'menu_track',
    '7': 'menu_invoice', '8': 'menu_complaint', '9': 'menu_support',
  };

  const resolvedId = routeMap[id] ? id : (textToId[text] || null);

  if (resolvedId && routeMap[resolvedId]) {
    const [flow, step] = routeMap[resolvedId];
    await stateManager.transition(conversation, flow, step);
    // Immediately delegate to the new flow
    return flowRouter.route(event, conversation, contact);
  }

  // Unknown input fallback
  await sendButtons(from, {
    body: "I didn't quite get that. Please choose an option from the menu:",
    buttons: [
      { id: 'fallback_menu', title: 'Main Menu' },
      { id: 'fallback_human', title: 'Talk to Team' },
    ],
  });
}

module.exports = { handle };
