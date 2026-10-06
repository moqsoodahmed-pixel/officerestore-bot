'use strict';

const { sendText, sendButtons, sendList } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const leadsService = require('../../services/leads/leadsService');
const Contact = require('../../models/Contact');
const {
  SALES_BTN, MENU_BTN, SKIP_BTN, getInput, isSkip, parseNumber,
  setData, getData, resetData, handleGlobalButtons,
  TIMELINE_ROWS, resolveTimeline, sendAnythingElse,
} = require('./common');

/**
 * Bulk / Corporate Requirement (spec section 3)
 * company → contact person → phone → seats → furniture → location → budget
 * → expected purchase date → HIGH priority HOT lead + sales alert
 */

const FLOW = 'bulk_corporate';

async function handle(event, conversation, contact) {
  if (await handleGlobalButtons(event, conversation, contact)) return;

  const { from } = event;
  const step = conversation.currentStep;
  const input = getInput(event);

  if (step === 'initial') {
    resetData(conversation);
    await sendText(from,
      '🏢 *Bulk / Corporate Requirement*\n\n' +
      "We'll collect a few details so our corporate sales team can help you quickly.\n\n" +
      'What is your *company name*?');
    await stateManager.transition(conversation, FLOW, 'awaiting_company');
    return;
  }

  if (step === 'awaiting_company') {
    if (input.length < 2) return sendText(from, 'Please type your company name.');
    setData(conversation, { companyName: input });
    await sendText(from, 'Who is the *contact person*? (Name)');
    await stateManager.transition(conversation, FLOW, 'awaiting_contact');
    return;
  }

  if (step === 'awaiting_contact') {
    if (input.length < 2) return sendText(from, 'Please type the contact person\'s name.');
    setData(conversation, { contactName: input });
    await sendButtons(from, {
      body: `Which *phone number* should our team call?\n\nTap below to use +${from}, or type another number.`,
      buttons: [{ id: 'bulk_same_phone', title: 'Use this number' }],
    });
    await stateManager.transition(conversation, FLOW, 'awaiting_phone');
    return;
  }

  if (step === 'awaiting_phone') {
    let phone = null;
    if (event.interactiveId === 'bulk_same_phone') {
      phone = from;
    } else {
      const digits = (event.text || '').replace(/\D/g, '');
      if (digits.length === 10) phone = `91${digits}`;
      else if (digits.length >= 11 && digits.length <= 13) phone = digits;
    }
    if (!phone) {
      await sendButtons(from, {
        body: 'Please type a valid 10-digit phone number, or tap below.',
        buttons: [{ id: 'bulk_same_phone', title: 'Use this number' }],
      });
      return;
    }
    setData(conversation, { phone });
    await sendText(from, 'How many *seats / people* is this for? (Type a number, e.g. *40*)');
    await stateManager.transition(conversation, FLOW, 'awaiting_seats');
    return;
  }

  if (step === 'awaiting_seats') {
    const seats = parseNumber(event.text);
    if (!seats) return sendText(from, 'Please type the number of seats, e.g. *40*.');
    setData(conversation, { seats });
    await sendText(from,
      'What *furniture* do you need?\n\n' +
      '_Example: 40 workstations, 40 chairs, 2 conference tables_');
    await stateManager.transition(conversation, FLOW, 'awaiting_furniture');
    return;
  }

  if (step === 'awaiting_furniture') {
    if (input.length < 3) return sendText(from, 'Please tell us which furniture you need.');
    setData(conversation, { furniture: input });
    await sendText(from, 'What is the *delivery location*? (Area / city)');
    await stateManager.transition(conversation, FLOW, 'awaiting_location');
    return;
  }

  if (step === 'awaiting_location') {
    if (input.length < 2) return sendText(from, 'Please share the delivery location (area / city).');
    setData(conversation, { location: input });
    await sendButtons(from, {
      body: 'What is your approximate *budget*? Type it (e.g. *10 lakh*), or tap Skip.',
      buttons: [SKIP_BTN, SALES_BTN],
    });
    await stateManager.transition(conversation, FLOW, 'awaiting_budget');
    return;
  }

  if (step === 'awaiting_budget') {
    if (!isSkip(event) && input.length < 1) {
      await sendButtons(from, { body: 'Please type your budget, or tap Skip.', buttons: [SKIP_BTN, SALES_BTN] });
      return;
    }
    setData(conversation, { budget: isSkip(event) ? null : input });
    await sendList(from, {
      body: 'When do you expect to purchase?',
      buttonLabel: 'Timeline',
      sections: [{ title: 'Expected purchase', rows: TIMELINE_ROWS }],
    });
    await stateManager.transition(conversation, FLOW, 'awaiting_timeline');
    return;
  }

  if (step === 'awaiting_timeline') {
    const timeline = resolveTimeline(event);
    if (!timeline) return sendText(from, 'Please tap *Timeline* above and choose an option.');
    setData(conversation, { timeline });
    return createBulkLead(event, conversation, contact);
  }

  if (step === 'done') return sendAnythingElse(from);

  await stateManager.transition(conversation, FLOW, 'initial');
  return handle(event, conversation, contact);
}

async function createBulkLead(event, conversation, contact) {
  const { from } = event;
  const d = getData(conversation);

  // Remember company / name on the contact for future conversations
  await Contact.updateOne(
    { whatsappNumber: from },
    { $set: { companyName: d.companyName } }
  ).catch(() => {});

  const lead = await leadsService.createLead({
    leadType: 'bulk_office',
    priority: 'HIGH',
    whatsappNumber: from,
    contactId: conversation.contactId,
    customerName: d.contactName || contact.name,
    companyName: d.companyName,
    contactPhone: d.phone,
    seats: d.seats,
    quantity: d.seats,
    requirement: d.furniture,
    location: d.location,
    budget: d.budget || undefined,
    timeline: d.timeline,
    source: conversation.entrySource || 'whatsapp',
    alertReason: 'Bulk / Corporate requirement',
  });
  conversation.currentLeadId = lead.leadId;

  await sendButtons(from, {
    body:
      '✅ *Thank you! Your corporate requirement has been recorded.*\n\n' +
      `Company: ${d.companyName}\n` +
      `Contact: ${d.contactName}\n` +
      `Phone: +${d.phone}\n` +
      `Seats: ${d.seats}\n` +
      `Furniture: ${d.furniture}\n` +
      `Location: ${d.location}\n` +
      `Budget: ${d.budget || 'Not specified'}\n` +
      `Timeline: ${d.timeline}\n\n` +
      'Our corporate sales team has been notified and will contact you shortly.\n\n' +
      `Reference: ${lead.leadId}`,
    buttons: [SALES_BTN, MENU_BTN],
  });
  await stateManager.transition(conversation, FLOW, 'done');
}

module.exports = { handle };