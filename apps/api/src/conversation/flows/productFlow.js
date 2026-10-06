'use strict';

const {
  sendText, sendList, sendButtons, sendAddAnotherOrDone,
} = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const catalogueService = require('../../services/catalogue/catalogueService');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Product Browse & Multi-Selection Flow.
 *
 * KEY REQUIREMENT: Multi-selection via repeated turns.
 * - Show categories (excluding already-selected ones)
 * - After selection, ask "Add Another" or "Done"
 * - Collect quantity per item
 * - Show summary at the end
 */

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;
  const { from } = event;

  switch (step) {
    case 'initial':
      return startProductBrowse(event, conversation, contact);

    case 'awaiting_category_selection':
      return handleCategorySelection(event, conversation, contact);

    case 'awaiting_quantity':
      return handleQuantityInput(event, conversation, contact);

    case 'awaiting_add_or_done':
      return handleAddOrDone(event, conversation, contact);

    case 'awaiting_product_detail':
      return handleProductDetailChoice(event, conversation, contact);

    case 'show_summary':
      return handleSummaryAction(event, conversation, contact);

    default:
      return startProductBrowse(event, conversation, contact);
  }
}

// ─── Step: Show category list ─────────────────────────────────────────────────

async function startProductBrowse(event, conversation, contact) {
  const { from } = event;
  // Clear previous selection when starting fresh
  conversation.selectedItems = [];
  conversation.selectedCategories = [];
  await stateManager.saveConversation(conversation);

  await showCategoryList(from, conversation, 'Happy to help! 🪑 What are you looking for?');
  await stateManager.transition(conversation, 'browse_products', 'awaiting_category_selection');
}

async function showCategoryList(to, conversation, bodyText) {
  const categories = await catalogueService.getCategories();
  const alreadySelected = conversation.selectedCategories || [];

  // Exclude already-selected categories
  const available = categories.filter((c) => !alreadySelected.includes(c.key));

  if (available.length === 0) {
    // All categories selected — force done
    return showRequirementSummary(to, conversation);
  }

  // Build section rows (WhatsApp list max 10 rows)
  const rows = available.slice(0, 9).map((cat) => ({
    id: `cat_${cat.key}`,
    title: `${cat.emoji || ''} ${cat.label}`.trim(),
    description: alreadySelected.length > 0
      ? `Already selected: ${alreadySelected.length} item(s)` : undefined,
  }));

  // Show already-selected summary in body if any
  let body = bodyText;
  if (alreadySelected.length > 0) {
    const selectedList = conversation.selectedItems
      .map((i) => `✓ ${i.categoryLabel}`)
      .join(', ');
    body += `\n\nAlready added: ${selectedList}`;
  }

  await sendList(to, {
    header: '🛒 Browse Products',
    body,
    footer: 'Reply MENU to return to main menu.',
    buttonLabel: 'Choose Category',
    sections: [{ title: 'Product Categories', rows }],
  });
}

// ─── Step: Handle category selection ─────────────────────────────────────────

async function handleCategorySelection(event, conversation, contact) {
  const { from, interactiveId, text } = event;
  const id = interactiveId || '';

  if (!id.startsWith('cat_') && !id.startsWith('something_else')) {
    // Try to match text
    if (id === 'done_selection' || (text || '').toLowerCase() === 'done') {
      return showRequirementSummary(from, conversation);
    }
    await sendText(from, "Please use the list to select a product category, or type MENU to go back.");
    return;
  }

  const categoryKey = id.replace('cat_', '');

  // Special case: Something Else
  if (categoryKey === 'something_else') {
    await sendText(
      from,
      'Please describe what you\'re looking for (product name, type or specifications).\n\n' +
      'Our team will find the best match for you.'
    );
    await stateManager.transition(conversation, 'browse_products', 'awaiting_product_detail');
    return;
  }

  const categories = await catalogueService.getCategories();
  const category = categories.find((c) => c.key === categoryKey);

  if (!category) {
    await sendText(from, "I didn't find that category. Please choose from the list.");
    return;
  }

  // Store selected category temporarily, ask for quantity
  conversation.stepData = conversation.stepData || {};
  conversation.stepData.pendingCategoryKey = category.key;
  conversation.stepData.pendingCategoryLabel = category.label;
  await stateManager.saveConversation(conversation);

  await sendButtons(from, {
    header: `${category.emoji || ''} ${category.label}`,
    body: `How many *${category.label}* do you need?\n\nPlease type the quantity (e.g. 10):`,
    footer: 'You can type a number or skip quantity.',
    buttons: [
      { id: 'qty_skip', title: 'Skip Quantity' },
    ],
  });
  await stateManager.transition(conversation, 'browse_products', 'awaiting_quantity');
}

// ─── Step: Handle quantity input ──────────────────────────────────────────────

async function handleQuantityInput(event, conversation, contact) {
  const { from, text, interactiveId } = event;
  const step = conversation.stepData || {};
  const categoryKey = step.pendingCategoryKey;
  const categoryLabel = step.pendingCategoryLabel;

  let quantity = null;

  if (interactiveId === 'qty_skip') {
    quantity = null;
  } else {
    const parsed = parseInt((text || '').trim(), 10);
    if (isNaN(parsed) || parsed < 1) {
      await sendButtons(from, {
        body: `Please enter a valid quantity for *${categoryLabel}* (e.g. type *10*):`,
        buttons: [{ id: 'qty_skip', title: 'Skip Quantity' }],
      });
      return;
    }
    quantity = parsed;
  }

  // Add to selected items
  const newItem = {
    categoryKey,
    categoryLabel,
    quantity,
  };

  conversation.selectedItems = [...(conversation.selectedItems || []), newItem];
  conversation.selectedCategories = [...(conversation.selectedCategories || []), categoryKey];
  conversation.stepData = {};
  await stateManager.saveConversation(conversation);

  const qtyText = quantity ? ` (Qty: ${quantity})` : '';
  const allSelectedLabels = conversation.selectedItems.map(
    (i) => `${i.categoryLabel}${i.quantity ? ` — ${i.quantity}` : ''}`
  );

  await sendAddAnotherOrDone(
    from,
    `${categoryLabel}${qtyText}`,
    allSelectedLabels
  );
  await stateManager.transition(conversation, 'browse_products', 'awaiting_add_or_done');
}

// ─── Step: Add Another or Done ────────────────────────────────────────────────

async function handleAddOrDone(event, conversation, contact) {
  const { from, interactiveId, text } = event;
  const id = interactiveId || '';

  if (id === 'add_another' || (text || '').toLowerCase().includes('add')) {
    // Show remaining categories
    await showCategoryList(from, conversation, 'What else would you like to add?');
    await stateManager.transition(conversation, 'browse_products', 'awaiting_category_selection');
    return;
  }

  if (id === 'done_selection' || (text || '').toLowerCase() === 'done') {
    await showRequirementSummary(from, conversation);
    return;
  }

  // Unknown
  await sendButtons(from, {
    body: 'Please choose:',
    buttons: [
      { id: 'add_another', title: 'Add Another' },
      { id: 'done_selection', title: 'Done ✓' },
    ],
  });
}

// ─── Show requirement summary ─────────────────────────────────────────────────

async function showRequirementSummary(to, conversation) {
  const items = conversation.selectedItems || [];

  if (items.length === 0) {
    await sendText(to, 'No items selected. Let\'s start over.\n\nReply MENU to return to the main menu.');
    await stateManager.transition(conversation, 'welcome', 'main_menu');
    return;
  }

  const lines = items.map((item, i) =>
    `${i + 1}. ${item.categoryLabel}${item.quantity ? ` — Qty: ${item.quantity}` : ''}`
  );

  const body =
    `*📋 Your Requirement*\n\n${lines.join('\n')}\n\n` +
    `What would you like to do next?`;

  await sendButtons(to, {
    header: 'Officerestore',
    body,
    footer: 'Reply MENU anytime.',
    buttons: [
      { id: 'summary_quote', title: 'Request a Quote' },
      { id: 'summary_edit', title: 'Edit Selection' },
      { id: 'summary_human', title: 'Talk to Sales' },
    ],
  });
  await stateManager.transition(conversation, 'browse_products', 'show_summary');
}

// ─── Step: Summary action ─────────────────────────────────────────────────────

async function handleSummaryAction(event, conversation, contact) {
  const { from, interactiveId } = event;
  const id = interactiveId || '';

  if (id === 'summary_quote') {
    // Move to quote flow with pre-filled items
    await stateManager.transition(conversation, 'quote', 'initial');
    const quoteFlow = require('./quoteFlow');
    return quoteFlow.handle(event, conversation, contact);
  }

  if (id === 'summary_edit') {
    // Let customer re-add — reset and show categories again
    conversation.selectedItems = [];
    conversation.selectedCategories = [];
    await stateManager.saveConversation(conversation);
    await showCategoryList(from, conversation, 'Let\'s start over. What are you looking for?');
    await stateManager.transition(conversation, 'browse_products', 'awaiting_category_selection');
    return;
  }

  if (id === 'summary_human' || id === 'fallback_human') {
    const supportFlow = require('./supportFlow');
    await stateManager.transition(conversation, 'human_handoff', 'initial');
    return supportFlow.handle(event, conversation, contact);
  }

  // Unknown — re-show summary options
  await showRequirementSummary(from, conversation);
}

// ─── Step: Handle free-text product detail ────────────────────────────────────

async function handleProductDetailChoice(event, conversation, contact) {
  const { from, text } = event;
  if (!text || text.trim().length < 3) {
    await sendText(from, 'Please describe what you\'re looking for.');
    return;
  }

  // Store the description and move to quote
  const newItem = {
    categoryKey: 'something_else',
    categoryLabel: 'Custom / Other',
    productName: text.trim(),
    quantity: null,
  };
  conversation.selectedItems = [...(conversation.selectedItems || []), newItem];
  conversation.selectedCategories = [...(conversation.selectedCategories || []), 'something_else'];
  await stateManager.saveConversation(conversation);

  await sendButtons(from, {
    body: `Got it! "${text.trim()}"\n\nWould you like to add another item or proceed?`,
    buttons: [
      { id: 'add_another', title: 'Add Another' },
      { id: 'done_selection', title: 'Done ✓' },
    ],
  });
  await stateManager.transition(conversation, 'browse_products', 'awaiting_add_or_done');
}

module.exports = { handle };
