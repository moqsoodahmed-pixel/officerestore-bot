'use strict';

const { sendText, sendButtons, sendList } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const leadsService = require('../../services/leads/leadsService');
const catalogueService = require('../../services/catalogue/catalogueService');
const {
  SALES_BTN, MENU_BTN, SKIP_BTN, getInput, isSkip, parseNumber,
  setData, getData, resetData, handleGlobalButtons, formatProducts, filterProducts, sendAnythingElse,
} = require('./common');

/**
 * Buy Office Furniture (spec section 3)
 * category → quantity → budget (optional) → live product search → actions
 */

const FLOW = 'buy_furniture';

const CATEGORIES = [
  { id: 'cat_chairs', title: 'Office Chairs' },
  { id: 'cat_workstations', title: 'Workstations' },
  { id: 'cat_tables', title: 'Office Tables' },
  { id: 'cat_sofas', title: 'Sofas' },
  { id: 'cat_storage', title: 'Storage' },
  { id: 'cat_reception', title: 'Reception Furniture' },
  { id: 'cat_partitions', title: 'Partitions' },
  { id: 'cat_conference', title: 'Conference Furniture' },
  { id: 'cat_other', title: 'Other' },
];

async function handle(event, conversation, contact) {
  if (await handleGlobalButtons(event, conversation, contact)) return;

  const { from } = event;
  const step = conversation.currentStep;

  // ── 1. Show categories ───────────────────────────────────────────────────
  if (step === 'initial') {
    resetData(conversation);
    await sendList(from, {
      header: '🛋️ Buy Office Furniture',
      body: 'What are you looking for? Choose a category:',
      buttonLabel: 'Categories',
      sections: [{ title: 'Categories', rows: CATEGORIES }],
    });
    await stateManager.transition(conversation, FLOW, 'awaiting_category');
    return;
  }

  // ── 2. Category chosen → ask quantity ────────────────────────────────────
  if (step === 'awaiting_category') {
    const cat = CATEGORIES.find((c) =>
      c.id === event.interactiveId || c.title.toLowerCase() === getInput(event).toLowerCase());
    if (!cat) {
      await sendText(from, 'Please tap *Categories* above and choose one from the list.');
      return;
    }
    setData(conversation, { categoryId: cat.id, category: cat.title });

    await sendText(from, `*${cat.title}* — great choice.\n\nHow many do you need? Please type a number (e.g. 5).`);
    await stateManager.transition(conversation, FLOW, 'awaiting_quantity');
    return;
  }

  // ── 3. Quantity → ask budget ─────────────────────────────────────────────
  if (step === 'awaiting_quantity') {
    const qty = parseNumber(event.text);
    if (!qty || qty < 1) {
      await sendText(from, 'Please type the quantity as a number, e.g. *10*.');
      return;
    }
    setData(conversation, { quantity: qty });

    await sendButtons(from, {
      body: `Quantity: *${qty}*\n\nWhat's your budget per piece? (e.g. ₹3,000)\n\nNot sure yet? Tap *Skip* and we'll show you all available options.`,
      buttons: [SKIP_BTN, SALES_BTN],
    });
    await stateManager.transition(conversation, FLOW, 'awaiting_budget');
    return;
  }

  // ── 4. Budget → search live catalogue ────────────────────────────────────
  if (step === 'awaiting_budget') {
    let budgetPerUnit = null;
    if (!isSkip(event)) {
      budgetPerUnit = parseNumber(event.text);
      if (!budgetPerUnit) {
        await sendButtons(from, {
          body: 'Please type your budget as a number, like *3000*.\n\nOr tap *Skip* to see all options.',
          buttons: [SKIP_BTN, SALES_BTN],
        });
        return;
      }
    }
    setData(conversation, { budgetPerUnit });
    return showResults(event, conversation, contact);
  }

  // ── 5. Actions after results ─────────────────────────────────────────────
  if (step === 'results_shown') {
    if (event.interactiveId === 'buy_quote') return requestQuote(event, conversation);
    await sendButtons(from, {
      body: 'Would you like a quotation, or to speak with our sales team?',
      buttons: [{ id: 'buy_quote', title: 'Request Quote' }, SALES_BTN, MENU_BTN],
    });
    return;
  }

  if (step === 'done') return sendAnythingElse(from);

  // Unknown step → restart this flow
  await stateManager.transition(conversation, FLOW, 'initial');
  return handle(event, conversation, contact);
}

async function showResults(event, conversation, contact) {
  const { from } = event;
  const d = getData(conversation);

  const products = filterProducts(
    await catalogueService.searchProducts(d.category, d.categoryId),
    { budgetPerUnit: d.budgetPerUnit }
  ).slice(0, 5);

  const budgetText = d.budgetPerUnit ? `₹${d.budgetPerUnit.toLocaleString('en-IN')} per item` : undefined;

  const lead = await leadsService.createLead({
    leadType: 'product_enquiry',
    whatsappNumber: from,
    contactId: conversation.contactId,
    customerName: contact.name,
    category: d.category,
    quantity: d.quantity,
    budget: budgetText,
    requirement: `${d.quantity} × ${d.category}${budgetText ? ` (budget ${budgetText})` : ''}`,
    items: [{ categoryKey: d.categoryId, categoryLabel: d.category, quantity: d.quantity }],
    source: conversation.entrySource || 'whatsapp',
    alertReason: 'Buy Office Furniture enquiry',
  });
  conversation.currentLeadId = lead.leadId;

  if (products.length) {
    await sendText(from, `Here are available options for *${d.category}*:\n\n${formatProducts(products)}`);
    await sendButtons(from, {
      body: 'Would you like a quotation for these, or to speak with our sales team?',
      buttons: [{ id: 'buy_quote', title: 'Request Quote' }, SALES_BTN, MENU_BTN],
    });
  } else {
    await sendButtons(from, {
      body:
        `Thanks! We've noted your requirement: *${d.quantity} × ${d.category}*` +
        `${budgetText ? ` (budget ${budgetText})` : ''}.\n\n` +
        'Our sales team will share the currently available options, photos and prices with you.\n\n' +
        `Reference: ${lead.leadId}`,
      buttons: [{ id: 'buy_quote', title: 'Request Quote' }, SALES_BTN, MENU_BTN],
    });
  }

  await stateManager.transition(conversation, FLOW, 'results_shown');
}

async function requestQuote(event, conversation) {
  const { from } = event;
  let lead = null;
  if (conversation.currentLeadId) {
    lead = await leadsService.updateLead(conversation.currentLeadId, { quoteRequested: true });
    if (lead) await leadsService.notifySales(lead, 'Quotation requested');
  }

  await sendButtons(from, {
    body:
      '✅ *Quote request received!*\n\n' +
      'Our sales team will prepare a quotation and contact you shortly.' +
      (lead ? `\n\nReference: ${lead.leadId}` : ''),
    buttons: [SALES_BTN, MENU_BTN],
  });
  await stateManager.transition(conversation, FLOW, 'done');
}

module.exports = { handle };