'use strict';

const { sendButtons } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const config = require('../../config');
const { SALES_BTN, MENU_BTN, handleGlobalButtons, sendAnythingElse } = require('./common');

/**
 * Visit Our Store (spec section 3)
 * All values come from Railway variables: STORE_ADDRESS, STORE_HOURS,
 * STORE_MAP_URL, SALES_PHONE. Nothing is hard-coded.
 * Use "\n" inside STORE_ADDRESS / STORE_HOURS for line breaks.
 */

const FLOW = 'store_visit';

function clean(value) {
  return (value || '').replace(/\\n/g, '\n').trim();
}

async function handle(event, conversation, contact) {
  if (await handleGlobalButtons(event, conversation, contact)) return;

  const { from } = event;

  if (conversation.currentStep !== 'initial') return sendAnythingElse(from);

  const address = clean(config.store.address);
  const hours = clean(config.store.hours);
  const mapUrl = clean(config.store.mapUrl);
  const phone = clean(config.store.salesPhone);

  let body = '📍 *Visit Our Store*\n\n';

  if (address) {
    body += `*Address:*\n${address}\n\n`;
    if (hours) body += `*Timings:*\n${hours}\n\n`;
    if (mapUrl) body += `*Directions:*\n${mapUrl}\n\n`;
    if (phone) body += `*Sales:* ${phone}\n\n`;
    body += 'See our refurbished furniture in person — we look forward to your visit!';
  } else {
    // Store details not configured yet — never guess an address
    body += 'Our sales team will share the store address, timings and directions with you.';
    if (phone) body += `\n\n*Sales:* ${phone}`;
  }

  await sendButtons(from, { body, buttons: [SALES_BTN, MENU_BTN] });
  await stateManager.transition(conversation, FLOW, 'done');
}

module.exports = { handle };