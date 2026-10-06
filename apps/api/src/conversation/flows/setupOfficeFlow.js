'use strict';

const { sendText, sendButtons, sendList } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const leadsService = require('../../services/leads/leadsService');
const {
  SALES_BTN, MENU_BTN, SKIP_BTN, getInput, isSkip, parseNumber,
  setData, getData, resetData, handleGlobalButtons,
  TIMELINE_ROWS, resolveTimeline, sendAnythingElse,
} = require('./common');

/**
 * Setup My Office (spec section 3)
 * team size → furniture required → location → budget → timeline → lead + quote/sales
 */

const FLOW = 'setup_office';

const TEAM_SIZES = [
  { id: 'ts_1_10', title: '1–10 people', max: 10 },
  { id: 'ts_11_25', title: '11–25 people', max: 25 },
  { id: 'ts_26_50', title: '26–50 people', max: 50 },
  { id: 'ts_51_100', title: '51–100 people', max: 100 },
  { id: 'ts_100_plus', title: '100+ people', max: 101 },
];

async function handle(event, conversation, contact) {
  if (await handleGlobalButtons(event, conversation, contact)) return;

  const { from } = event;
  const step = conversation.currentStep;
  const input = getInput(event);

  if (step === 'initial') {
    resetData(conversation);
    await sendList(from, {
      header: '🏢 Setup My Office',
      body: "Let's plan your office. How big is your team?",
      buttonLabel: 'Team Size',
      sections: [{ title: 'Team size', rows: TEAM_SIZES.map(({ id, title }) => ({ id, title })) }],
    });
    await stateManager.transition(conversation, FLOW, 'awaiting_team_size');
    return;
  }

  if (step === 'awaiting_team_size') {
    const size = TEAM_SIZES.find((t) => t.id === event.interactiveId || t.title.toLowerCase() === input.toLowerCase());
    if (!size) {
      await sendText(from, 'Please tap *Team Size* above and choose an option.');
      return;
    }
    setData(conversation, { teamSize: size.title.replace(' people', ''), teamMax: size.max });
    await sendText(from,
      'What furniture do you need?\n\n' +
      '_Example: 20 workstations, 20 chairs, 1 conference table, 2 storage units_');
    await stateManager.transition(conversation, FLOW, 'awaiting_furniture');
    return;
  }

  if (step === 'awaiting_furniture') {
    if (input.length < 3) {
      await sendText(from, 'Please tell us which furniture you need.');
      return;
    }
    setData(conversation, { furniture: input });
    await sendText(from, 'Where is your office located? (Area / city, e.g. *Whitefield, Bangalore*)');
    await stateManager.transition(conversation, FLOW, 'awaiting_location');
    return;
  }

  if (step === 'awaiting_location') {
    if (input.length < 2) {
      await sendText(from, 'Please share your office location (area / city).');
      return;
    }
    setData(conversation, { location: input });
    await sendButtons(from, {
      body: 'What is your approximate total budget? Type it (e.g. *5 lakh*), or tap Skip.',
      buttons: [SKIP_BTN, SALES_BTN],
    });
    await stateManager.transition(conversation, FLOW, 'awaiting_budget');
    return;
  }

  if (step === 'awaiting_budget') {
    const budget = isSkip(event) ? null : input;
    if (!isSkip(event) && (!budget || budget.length < 1)) {
      await sendButtons(from, { body: 'Please type your budget, or tap Skip.', buttons: [SKIP_BTN, SALES_BTN] });
      return;
    }
    setData(conversation, { budget });
    await sendList(from, {
      body: 'When are you planning to buy?',
      buttonLabel: 'Timeline',
      sections: [{ title: 'Purchase timeline', rows: TIMELINE_ROWS }],
    });
    await stateManager.transition(conversation, FLOW, 'awaiting_timeline');
    return;
  }

  if (step === 'awaiting_timeline') {
    const timeline = resolveTimeline(event);
    if (!timeline) {
      await sendText(from, 'Please tap *Timeline* above and choose an option.');
      return;
    }
    setData(conversation, { timeline });
    return createSetupLead(event, conversation, contact);
  }

  if (step === 'lead_created') {
    if (event.interactiveId === 'setup_quote') return requestQuote(event, conversation);
    return sendAnythingElse(from);
  }

  if (step === 'done') return sendAnythingElse(from);

  await stateManager.transition(conversation, FLOW, 'initial');
  return handle(event, conversation, contact);
}

async function createSetupLead(event, conversation, contact) {
  const { from } = event;
  const d = getData(conversation);

  const lead = await leadsService.createLead({
    leadType: 'office_setup',
    whatsappNumber: from,
    contactId: conversation.contactId,
    customerName: contact.name,
    teamSize: d.teamSize,
    requirement: `Office setup for ${d.teamSize} people: ${d.furniture}`,
    location: d.location,
    budget: d.budget || undefined,
    timeline: d.timeline,
    source: conversation.entrySource || 'whatsapp',
    alertReason: 'Setup My Office enquiry',
  });
  conversation.currentLeadId = lead.leadId;

  await sendButtons(from, {
    body:
      '✅ *Thank you! Here is your requirement:*\n\n' +
      `Team size: ${d.teamSize}\n` +
      `Furniture: ${d.furniture}\n` +
      `Location: ${d.location}\n` +
      `Budget: ${d.budget || 'Not specified'}\n` +
      `Timeline: ${d.timeline}\n\n` +
      'We can prepare a customised quotation for your office.\n\n' +
      `Reference: ${lead.leadId}`,
    buttons: [{ id: 'setup_quote', title: 'Get Custom Quote' }, SALES_BTN, MENU_BTN],
  });
  await stateManager.transition(conversation, FLOW, 'lead_created');
}

async function requestQuote(event, conversation) {
  const { from } = event;
  const lead = await leadsService.updateLead(conversation.currentLeadId, { quoteRequested: true });
  if (lead) await leadsService.notifySales(lead, 'Custom office setup quotation requested');

  await sendButtons(from, {
    body:
      '✅ *Quotation request received!*\n\n' +
      'Our sales team will prepare a customised quotation for your office and contact you shortly.',
    buttons: [SALES_BTN, MENU_BTN],
  });
  await stateManager.transition(conversation, FLOW, 'done');
}

module.exports = { handle };