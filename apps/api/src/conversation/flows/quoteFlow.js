'use strict';

const { sendText, sendButtons, sendList } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const leadsService = require('../../services/leads/leadsService');
const quotesService = require('../../services/quotes/quotesService');

/**
 * Quote Request Flow.
 * Collects: items (from prior selection or fresh), PIN, billing type, date.
 */

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;
  const { from } = event;

  switch (step) {
    case 'initial':
      return startQuoteFlow(event, conversation, contact);
    case 'awaiting_items':
      return handleItemsChoice(event, conversation, contact);
    case 'ask_pin':
      return collectPin(event, conversation, contact);
    case 'ask_billing':
      return collectBilling(event, conversation, contact);
    case 'ask_required_date':
      return collectRequiredDate(event, conversation, contact);
    case 'confirm':
      return handleConfirm(event, conversation, contact);
    default:
      return startQuoteFlow(event, conversation, contact);
  }
}

async function startQuoteFlow(event, conversation, contact) {
  const { from } = event;
  const hasItems = (conversation.selectedItems || []).length > 0;

  if (hasItems) {
    const lines = conversation.selectedItems.map((i, n) =>
      `${n + 1}. ${i.categoryLabel}${i.quantity ? ` — Qty: ${i.quantity}` : ' — Qty: TBD'}`
    ).join('\n');

    await sendButtons(from, {
      body: `*📋 Quote Request*\n\nYour current selection:\n${lines}\n\nWould you like to proceed with this selection or start fresh?`,
      buttons: [
        { id: 'quote_use_existing', title: 'Use This Selection' },
        { id: 'quote_fresh', title: 'Start Fresh' },
      ],
    });
    await stateManager.transition(conversation, 'quote', 'awaiting_items');
  } else {
    await sendText(from,
      '*📋 Get a Quote*\n\n' +
      'Please provide the product name, link or SKU.\n\n' +
      'Example:\n• "Executive Chair Model EC-200"\n• "https://officerestore.com/products/chair"\n• "SKU: OR-EC-200"\n\n' +
      'Or type MENU to return to the main menu.'
    );
    await stateManager.transition(conversation, 'quote', 'awaiting_product_input');
  }
}

async function handleItemsChoice(event, conversation, contact) {
  const { from, interactiveId, text } = event;

  if (interactiveId === 'quote_fresh') {
    conversation.selectedItems = [];
    conversation.selectedCategories = [];
    await stateManager.saveConversation(conversation);
    // Route to product flow first to gather items
    const productFlow = require('./productFlow');
    await stateManager.transition(conversation, 'browse_products', 'initial');
    return productFlow.handle(event, conversation, contact);
  }

  // Use existing selection — proceed to PIN
  await askPin(from, conversation);
}

async function askPin(to, conversation) {
  await sendText(to, 'Please enter your *delivery PIN code* (6 digits):');
  await stateManager.transition(conversation, 'quote', 'ask_pin');
}

async function collectPin(event, conversation, contact) {
  const { from, text } = event;
  const pin = (text || '').trim().replace(/\D/g, '');
  if (pin.length !== 6) {
    await sendText(from, 'Please enter a valid 6-digit PIN code:');
    return;
  }
  conversation.quoteData = { ...conversation.quoteData, deliveryPin: pin };
  await stateManager.saveConversation(conversation);

  await sendButtons(from, {
    body: 'Is this for *individual* or *business* billing?',
    buttons: [
      { id: 'billing_individual', title: 'Individual' },
      { id: 'billing_business', title: 'Business / GST' },
    ],
  });
  await stateManager.transition(conversation, 'quote', 'ask_billing');
}

async function collectBilling(event, conversation, contact) {
  const { from, interactiveId } = event;
  conversation.quoteData = {
    ...conversation.quoteData,
    billingType: interactiveId === 'billing_business' ? 'business' : 'individual',
  };
  await stateManager.saveConversation(conversation);

  await sendButtons(from, {
    body: 'Do you have a *required delivery date*?',
    buttons: [
      { id: 'date_yes', title: 'Yes, specific date' },
      { id: 'date_flexible', title: 'Flexible / ASAP' },
    ],
  });
  await stateManager.transition(conversation, 'quote', 'ask_required_date');
}

async function collectRequiredDate(event, conversation, contact) {
  const { from, interactiveId, text } = event;

  if (interactiveId === 'date_yes') {
    await sendText(from, 'Please enter your required delivery date (e.g. 20 October 2025):');
    return;
  }

  const dateValue = interactiveId === 'date_flexible'
    ? 'Flexible / As soon as possible'
    : (text || '').trim() || 'Flexible';

  conversation.quoteData = { ...conversation.quoteData, requiredByDate: dateValue };
  await stateManager.saveConversation(conversation);
  await showQuoteSummary(from, conversation, contact);
  await stateManager.transition(conversation, 'quote', 'confirm');
}

async function showQuoteSummary(to, conversation, contact) {
  const items = conversation.selectedItems || [];
  const q = conversation.quoteData || {};

  const itemLines = items.map((item, i) =>
    `${i + 1}. ${item.categoryLabel || item.productName}\n   Quantity: ${item.quantity || 'TBD'}`
  ).join('\n\n');

  const body =
    `*📄 Quote Request Summary*\n\n` +
    `${itemLines || 'No items specified.'}\n\n` +
    `Delivery PIN: ${q.deliveryPin || 'Not provided'}\n` +
    `Billing: ${q.billingType === 'business' ? 'Business / GST' : 'Individual'}\n` +
    `Required by: ${q.requiredByDate || 'Flexible'}\n\n` +
    `_Note: This is a quote request only. No price, stock or delivery is confirmed until reviewed by our team._`;

  await sendButtons(to, {
    header: 'Review Quote Request',
    body,
    buttons: [
      { id: 'quote_submit', title: 'Submit Request ✓' },
      { id: 'quote_edit', title: 'Edit' },
      { id: 'quote_cancel', title: 'Cancel' },
    ],
  });
}

async function handleConfirm(event, conversation, contact) {
  const { from, interactiveId } = event;

  if (interactiveId === 'quote_cancel') {
    await sendText(from, 'Quote request cancelled. Reply MENU to return to the main menu.');
    await stateManager.transition(conversation, 'welcome', 'main_menu');
    return;
  }

  if (interactiveId === 'quote_edit') {
    conversation.quoteData = {};
    await stateManager.saveConversation(conversation);
    return startQuoteFlow(event, conversation, contact);
  }

  if (interactiveId === 'quote_submit') {
    try {
      const result = await quotesService.createQuoteRequest({
        whatsappNumber: from,
        contactId: conversation.contactId,
        items: conversation.selectedItems,
        quoteData: conversation.quoteData,
        customerName: contact.name,
        companyName: contact.companyName,
        source: conversation.entrySource || 'whatsapp',
      });

      conversation.currentQuoteId = result.quoteId;
      await stateManager.transition(conversation, 'quote', 'submitted');

      const items = conversation.selectedItems || [];
      const shortSummary = items.map((i) => `${i.categoryLabel || i.productName}${i.quantity ? ` ×${i.quantity}` : ''}`).join(', ');

      await sendButtons(from, {
        body:
          `✅ *Quote request received!*\n\n` +
          `*Reference: ${result.quoteId}*\n` +
          `Requirement: ${shortSummary || 'As specified'}\n\n` +
          `Our team will validate pricing, stock and delivery and send you a formal quote.\n\n` +
          `_This is an acknowledgement, not a confirmed quote or stock reservation._`,
        buttons: [
          { id: 'menu_main', title: 'Main Menu' },
          { id: 'summary_human', title: 'Talk to Sales' },
        ],
      });
    } catch (err) {
      await sendText(from,
        '⚠️ We had trouble saving your quote request. Please try again or type HUMAN to reach our team.'
      );
    }
  }
}

module.exports = { handle };
