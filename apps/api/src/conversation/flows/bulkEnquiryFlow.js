'use strict';

const { sendText, sendButtons, sendList } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const leadsService = require('../../services/leads/leadsService');
const { v4: uuidv4 } = require('uuid');

/**
 * Bulk Office / Complete Office Setup Enquiry Flow.
 * Asks ONE question at a time.
 */

const STEPS = [
  'initial',
  'ask_company',
  'ask_contact_name',
  'ask_seats',
  'ask_products',
  'ask_pin',
  'ask_city',
  'ask_timeline',
  'ask_budget',
  'ask_special_req',
  'ask_installation',
  'confirm',
  'submitted',
];

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;
  const { from } = event;

  switch (step) {
    case 'initial':
      return askCompanyName(from, conversation, contact);
    case 'ask_company':
      return collectCompanyName(event, conversation, contact);
    case 'ask_contact_name':
      return collectContactName(event, conversation, contact);
    case 'ask_seats':
      return collectSeats(event, conversation, contact);
    case 'ask_products':
      return handleProductsStep(event, conversation, contact);
    case 'awaiting_product_selection':
      return handleProductSelection(event, conversation, contact);
    case 'awaiting_product_add_or_done':
      return handleProductAddOrDone(event, conversation, contact);
    case 'ask_pin':
      return collectPin(event, conversation, contact);
    case 'ask_city':
      return collectCity(event, conversation, contact);
    case 'ask_timeline':
      return collectTimeline(event, conversation, contact);
    case 'ask_budget':
      return collectBudget(event, conversation, contact);
    case 'ask_special_req':
      return collectSpecialReq(event, conversation, contact);
    case 'ask_installation':
      return collectInstallation(event, conversation, contact);
    case 'confirm':
      return handleConfirm(event, conversation, contact);
    default:
      return askCompanyName(from, conversation, contact);
  }
}

async function askCompanyName(to, conversation, contact) {
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};
  await stateManager.saveConversation(conversation);
  await sendText(to,
    '🏢 *Bulk Office Requirement*\n\n' +
    'Let\'s record your requirement. Our team will review and contact you.\n\n' +
    'Step 1 of 8\n\nWhat is your *company name*? (Or type "Skip" if not applicable)'
  );
  await stateManager.transition(conversation, 'bulk_enquiry', 'ask_company');
}

async function collectCompanyName(event, conversation, contact) {
  const { from, text } = event;
  const value = (text || '').trim();
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};
  if (value && value.toLowerCase() !== 'skip') {
    conversation.bulkEnquiry.companyName = value;
  }
  await stateManager.saveConversation(conversation);
  await sendText(from, 'Step 2 of 8\n\nWhat is your *contact name*?');
  await stateManager.transition(conversation, 'bulk_enquiry', 'ask_contact_name');
}

async function collectContactName(event, conversation, contact) {
  const { from, text } = event;
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};
  conversation.bulkEnquiry.contactName = (text || '').trim() || contact.name;
  await stateManager.saveConversation(conversation);
  await sendText(from, 'Step 3 of 8\n\nApproximately how many *seats / workstations* do you need to furnish?');
  await stateManager.transition(conversation, 'bulk_enquiry', 'ask_seats');
}

async function collectSeats(event, conversation, contact) {
  const { from, text } = event;
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};
  const seats = parseInt((text || '').trim(), 10);
  if (!isNaN(seats) && seats > 0) {
    conversation.bulkEnquiry.seats = seats;
  }
  await stateManager.saveConversation(conversation);
  return handleProductsStep(event, conversation, contact);
}

async function handleProductsStep(event, conversation, contact) {
  const { from } = event;
  // Reset product selection for bulk enquiry
  conversation.selectedItems = [];
  conversation.selectedCategories = [];
  await stateManager.saveConversation(conversation);
  await showBulkProductList(from, conversation);
  await stateManager.transition(conversation, 'bulk_enquiry', 'awaiting_product_selection');
}

async function showBulkProductList(to, conversation) {
  const { getCategories } = require('../../services/catalogue/catalogueService');
  const categories = await getCategories();
  const alreadySelected = conversation.selectedCategories || [];
  const available = categories.filter((c) => c.key !== 'something_else' && !alreadySelected.includes(c.key));

  const rows = available.slice(0, 9).map((c) => ({
    id: `bulk_cat_${c.key}`,
    title: `${c.emoji || ''} ${c.label}`.trim(),
  }));

  let body = 'Step 4 of 8\n\n*What products do you need?*\n\nSelect one at a time:';
  if (alreadySelected.length > 0) {
    const listed = conversation.selectedItems.map((i) =>
      `✓ ${i.categoryLabel}${i.quantity ? ` — ${i.quantity}` : ''}`
    ).join('\n');
    body += `\n\nSelected:\n${listed}`;
  }

  await require('../../services/msg91/whatsappService').sendList(to, {
    header: '🏢 Products Needed',
    body,
    buttonLabel: 'Select Product',
    sections: [{ title: 'Categories', rows }],
  });
}

async function handleProductSelection(event, conversation, contact) {
  const { from, interactiveId, text } = event;
  const id = interactiveId || '';

  if (!id.startsWith('bulk_cat_')) {
    await sendText(from, 'Please select a product from the list.');
    return;
  }

  const categoryKey = id.replace('bulk_cat_', '');
  const categories = await require('../../services/catalogue/catalogueService').getCategories();
  const category = categories.find((c) => c.key === categoryKey);
  if (!category) {
    await sendText(from, 'Category not found. Please try again.');
    return;
  }

  conversation.stepData = {
    ...conversation.stepData,
    pendingCategoryKey: category.key,
    pendingCategoryLabel: category.label,
  };
  await stateManager.saveConversation(conversation);

  await sendButtons(from, {
    body: `How many *${category.label}* do you need? Type the quantity:`,
    buttons: [{ id: 'bulk_qty_skip', title: 'Skip Quantity' }],
  });
  await stateManager.transition(conversation, 'bulk_enquiry', 'awaiting_bulk_qty');
}

// Handle quantity for bulk
async function handleProductAddOrDone(event, conversation, contact) {
  const { from, interactiveId, text } = event;
  const id = interactiveId || '';

  if (id === 'bulk_add_another') {
    await showBulkProductList(from, conversation);
    await stateManager.transition(conversation, 'bulk_enquiry', 'awaiting_product_selection');
    return;
  }

  if (id === 'bulk_done' || (text || '').toLowerCase() === 'done') {
    // Proceed to PIN
    await sendText(from, 'Step 5 of 8\n\nWhat is your *delivery PIN code*?');
    await stateManager.transition(conversation, 'bulk_enquiry', 'ask_pin');
    return;
  }

  await sendButtons(from, {
    body: 'Would you like to add another product?',
    buttons: [
      { id: 'bulk_add_another', title: 'Add Another' },
      { id: 'bulk_done', title: 'Done ✓' },
    ],
  });
}

async function collectPin(event, conversation, contact) {
  const { from, text } = event;
  const pin = (text || '').trim().replace(/\D/g, '');

  if (pin.length !== 6) {
    await sendText(from, 'Please enter a valid 6-digit PIN code.');
    return;
  }
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};
  conversation.bulkEnquiry.deliveryPin = pin;
  await stateManager.saveConversation(conversation);
  await sendText(from, 'Step 6 of 8\n\nWhich *city* is this for?');
  await stateManager.transition(conversation, 'bulk_enquiry', 'ask_city');
}

async function collectCity(event, conversation, contact) {
  const { from, text } = event;
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};
  conversation.bulkEnquiry.city = (text || '').trim();
  await stateManager.saveConversation(conversation);
  await sendList(from, {
    header: '📅 Timeline',
    body: 'Step 7 of 8\n\nWhat is your *expected purchase timeline*?',
    buttonLabel: 'Select Timeline',
    sections: [{
      title: 'Timeline',
      rows: [
        { id: 'timeline_immediate', title: 'Immediately', description: 'Within 1-2 weeks' },
        { id: 'timeline_1month', title: 'Within 1 month' },
        { id: 'timeline_3months', title: 'Within 3 months' },
        { id: 'timeline_6months', title: 'Within 6 months' },
        { id: 'timeline_planning', title: 'Just Planning', description: 'Exploring options' },
      ],
    }],
  });
  await stateManager.transition(conversation, 'bulk_enquiry', 'ask_timeline');
}

async function collectTimeline(event, conversation, contact) {
  const { from, interactiveId, text } = event;
  const timelineMap = {
    timeline_immediate: 'Immediately (1-2 weeks)',
    timeline_1month: 'Within 1 month',
    timeline_3months: 'Within 3 months',
    timeline_6months: 'Within 6 months',
    timeline_planning: 'Just planning / exploring',
  };
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};
  conversation.bulkEnquiry.timeline = timelineMap[interactiveId] || (text || '').trim() || 'Not specified';
  await stateManager.saveConversation(conversation);

  await sendButtons(from, {
    body: 'Step 8 of 8 (optional)\n\nDo you have a *budget range* in mind?',
    buttons: [
      { id: 'budget_yes', title: 'Yes, share budget' },
      { id: 'budget_skip', title: 'Skip' },
    ],
  });
  await stateManager.transition(conversation, 'bulk_enquiry', 'ask_budget');
}

async function collectBudget(event, conversation, contact) {
  const { from, interactiveId, text } = event;
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};

  if (interactiveId === 'budget_skip') {
    conversation.bulkEnquiry.budget = null;
  } else if (interactiveId === 'budget_yes') {
    await sendText(from, 'Please share your approximate budget (e.g. ₹5-10 lakh or ₹50,000):');
    return;
  } else {
    conversation.bulkEnquiry.budget = (text || '').trim() || null;
  }
  await stateManager.saveConversation(conversation);

  await sendButtons(from, {
    body: 'Any *special requirements*? (size, finish, ergonomic, standing desk, etc.)',
    buttons: [
      { id: 'special_yes', title: 'Yes, I have notes' },
      { id: 'special_skip', title: 'No, standard' },
    ],
  });
  await stateManager.transition(conversation, 'bulk_enquiry', 'ask_special_req');
}

async function collectSpecialReq(event, conversation, contact) {
  const { from, interactiveId, text } = event;
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};

  if (interactiveId === 'special_skip') {
    conversation.bulkEnquiry.specialRequirements = null;
  } else if (interactiveId === 'special_yes') {
    await sendText(from, 'Please describe any special size, finish or ergonomic requirements:');
    return;
  } else {
    conversation.bulkEnquiry.specialRequirements = (text || '').trim() || null;
  }
  await stateManager.saveConversation(conversation);

  await sendButtons(from, {
    body: 'Do you require *professional installation*?',
    buttons: [
      { id: 'install_yes', title: 'Yes, installation needed' },
      { id: 'install_no', title: 'No, self-install' },
      { id: 'install_unsure', title: 'Not sure yet' },
    ],
  });
  await stateManager.transition(conversation, 'bulk_enquiry', 'ask_installation');
}

async function collectInstallation(event, conversation, contact) {
  const { from, interactiveId } = event;
  conversation.bulkEnquiry = conversation.bulkEnquiry || {};
  conversation.bulkEnquiry.installationRequired =
    interactiveId === 'install_yes' ? true :
    interactiveId === 'install_no' ? false : null;
  await stateManager.saveConversation(conversation);
  await showConfirmation(from, conversation, contact);
  await stateManager.transition(conversation, 'bulk_enquiry', 'confirm');
}

async function showConfirmation(to, conversation, contact) {
  const e = conversation.bulkEnquiry || {};
  const items = (conversation.selectedItems || []);
  const productLines = items.length > 0
    ? items.map((i) => `• ${i.categoryLabel}${i.quantity ? ` — ${i.quantity} units` : ''}`).join('\n')
    : '• Not specified';

  const installText = e.installationRequired === true ? 'Yes' :
    e.installationRequired === false ? 'No' : 'To be confirmed';

  const body =
    `*📋 Bulk Requirement Summary*\n\n` +
    `Company: ${e.companyName || 'Not provided'}\n` +
    `Contact: ${e.contactName || contact.name || 'Not provided'}\n` +
    `Seats: ${e.seats || 'Not specified'}\n` +
    `Products:\n${productLines}\n` +
    `PIN Code: ${e.deliveryPin || 'Not provided'}\n` +
    `City: ${e.city || 'Not provided'}\n` +
    `Timeline: ${e.timeline || 'Not specified'}\n` +
    `Budget: ${e.budget || 'Not specified'}\n` +
    `Special Req: ${e.specialRequirements || 'None'}\n` +
    `Installation: ${installText}\n\n` +
    `_This is an enquiry. No quote, price or stock is confirmed until our team reviews it._`;

  await sendButtons(to, {
    header: 'Confirm Requirement',
    body,
    buttons: [
      { id: 'bulk_submit', title: 'Submit ✓' },
      { id: 'bulk_edit', title: 'Edit' },
      { id: 'bulk_cancel', title: 'Cancel' },
    ],
  });
}

async function handleConfirm(event, conversation, contact) {
  const { from, interactiveId } = event;
  const id = interactiveId || '';

  if (id === 'bulk_cancel') {
    await sendText(from, 'Cancelled. Reply MENU to return to the main menu.');
    await stateManager.transition(conversation, 'welcome', 'main_menu');
    return;
  }

  if (id === 'bulk_edit') {
    // Restart the flow
    conversation.bulkEnquiry = {};
    conversation.selectedItems = [];
    conversation.selectedCategories = [];
    await stateManager.saveConversation(conversation);
    await handle({ ...event }, conversation, contact);
    return;
  }

  if (id === 'bulk_submit') {
    try {
      const e = conversation.bulkEnquiry || {};
      const lead = await leadsService.createLead({
        leadType: 'bulk_office',
        whatsappNumber: from,
        contactId: conversation.contactId,
        customerName: e.contactName || contact.name,
        companyName: e.companyName,
        items: conversation.selectedItems,
        seats: e.seats,
        deliveryPin: e.deliveryPin,
        city: e.city,
        timeline: e.timeline,
        budget: e.budget,
        specialRequirements: e.specialRequirements,
        installationRequired: e.installationRequired,
        source: conversation.entrySource || 'whatsapp',
      });

      conversation.currentLeadId = lead.leadId;
      await stateManager.transition(conversation, 'bulk_enquiry', 'submitted');

      await sendButtons(from, {
        body:
          `✅ *Thank you!* We've recorded your bulk office requirement.\n\n` +
          `*Reference: ${lead.leadId}*\n\n` +
          `Our team will review your requirement and get in touch to confirm pricing, availability and delivery.\n\n` +
          `_This is an acknowledgement, not a confirmed quote or stock reservation._`,
        buttons: [
          { id: 'menu_main', title: 'Main Menu' },
          { id: 'summary_human', title: 'Talk to Sales' },
        ],
      });
    } catch (err) {
      await sendText(from,
        '⚠️ We encountered an issue saving your requirement. Please try again or type HUMAN to speak with our team.'
      );
    }
  }
}

module.exports = { handle };
