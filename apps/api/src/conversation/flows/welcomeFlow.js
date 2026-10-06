'use strict';

const { sendMainMenu, sendButtons } = require('../../services/msg91/whatsappService');
const { buildGreeting } = require('./common');
const stateManager = require('../stateManager');

// NOTE: flowRouter is required lazily inside the function (not at the top)
// because flowRouter also requires this file. A top-level require creates a
// circular dependency and flowRouter.route ends up undefined.

// Menu selection ID → [flow, step]  (spec section 2)
const ROUTE_MAP = {
  menu_buy: ['buy_furniture', 'initial'],
  menu_setup: ['setup_office', 'initial'],
  menu_bulk: ['bulk_corporate', 'initial'],
  menu_find: ['find_product', 'initial'],
  menu_visit: ['store_visit', 'initial'],
  menu_sales: ['talk_to_sales', 'initial'],
  // Old menu IDs (from messages sent before the update)
  menu_browse: ['buy_furniture', 'initial'],
  menu_quote: ['find_product', 'initial'],
  menu_support: ['talk_to_sales', 'initial'],
};

// User types a number instead of tapping
const NUMBER_TO_ID = {
  '1': 'menu_buy', '2': 'menu_setup', '3': 'menu_bulk',
  '4': 'menu_find', '5': 'menu_visit', '6': 'menu_sales',
};

// Fallback if the provider only gives us the row title, not the ID
const TITLE_TO_ID = {
  'buy office furniture': 'menu_buy',
  'setup my office': 'menu_setup',
  'bulk / corporate': 'menu_bulk',
  'find a product': 'menu_find',
  'visit our store': 'menu_visit',
  'talk to sales': 'menu_sales',
};

function resolveMenuSelection(event) {
  const id = event.interactiveId || '';
  if (ROUTE_MAP[id]) return id;

  const text = (event.text || '').trim();
  if (NUMBER_TO_ID[text]) return NUMBER_TO_ID[text];

  const title = (event.interactiveTitle || text).trim().toLowerCase();
  return TITLE_TO_ID[title] || null;
}

/**
 * Welcome Flow — handles main menu and routes to sub-flows.
 */
async function handle(event, conversation, contact) {
  const { from } = event;
  const step = conversation.currentStep;

  // ── A menu option was chosen → go straight to that flow ──────────────────
  // Checked first, so it works whether the menu was shown by this flow
  // (step = awaiting_menu_selection) or by the HI/MENU command (step = main_menu).
  const selection = resolveMenuSelection(event);
  if (selection) {
    const [flow, nextStep] = ROUTE_MAP[selection];
    conversation.currentLeadId = undefined; // new menu choice = new enquiry
    await stateManager.transition(conversation, flow, nextStep);
    const flowRouter = require('../flowRouter');
    return flowRouter.route(event, conversation, contact);
  }

  // ── First contact / menu requested → show the menu ───────────────────────
  if (step === 'initial' || step === 'main_menu' || !step) {
    const greeting = buildGreeting(contact);
    await sendMainMenu(from, greeting);
    await stateManager.transition(conversation, 'welcome', 'awaiting_menu_selection');
    return;
  }

  // ── Menu was shown but input wasn't recognised ───────────────────────────
  if (step === 'awaiting_menu_selection') {
    await sendButtons(from, {
      body: "I didn't quite get that. Please choose an option from the menu:",
      buttons: [
        { id: 'fallback_menu', title: 'Main Menu' },
        { id: 'fallback_human', title: 'Talk to Team' },
      ],
    });
    return;
  }

  // ── Anything else: re-show the menu ──────────────────────────────────────
  await sendMainMenu(from);
  await stateManager.transition(conversation, 'welcome', 'awaiting_menu_selection');
}

module.exports = { handle };