'use strict';

const { sendText, sendButtons } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const leadsService = require('../../services/leads/leadsService');
const AuditLog = require('../../models/AuditLog');
const config = require('../../config');
const logger = require('../../utils/logger');
const { MENU_BTN, SKIP_BTN, isSkip, getInput } = require('./common');

/**
 * Talk to Sales (spec sections 3 & 8)
 * Optional short requirement → create/update lead → alert sales →
 * hand the conversation to a human. The bot never blocks handover.
 *
 * After handover the bot stays silent for this customer until an agent
 * clicks "Release" in the dashboard (Conversations page).
 */

const FLOW = 'talk_to_sales';

/** Entry point used by the menu AND by every "Talk to Sales" button. */
async function start(event, conversation) {
  await sendButtons(event.from, {
    body:
      '👤 *Talk to Sales*\n\n' +
      "I'll connect you with our sales team.\n\n" +
      'Briefly tell us what you need (e.g. *"25 chairs for Whitefield office"*), or tap Skip.',
    buttons: [SKIP_BTN, MENU_BTN],
  });
  await stateManager.transition(conversation, FLOW, 'awaiting_requirement');
}

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;

  if (step === 'awaiting_requirement') {
    const requirement = isSkip(event) ? null : getInput(event);
    if (!isSkip(event) && (!requirement || requirement.length < 2)) {
      await sendButtons(event.from, {
        body: 'Please type a short description of what you need, or tap Skip.',
        buttons: [SKIP_BTN, MENU_BTN],
      });
      return;
    }
    return handover(event, conversation, contact, requirement);
  }

  // 'initial' or anything else
  return start(event, conversation);
}

async function handover(event, conversation, contact, requirement) {
  const { from } = event;
  let lead = null;

  try {
    // Update the lead from this conversation if there is one, else create one
    if (conversation.currentLeadId) {
      const updates = { handoverRequested: true };
      if (requirement) updates.notes = requirement;
      lead = await leadsService.updateLead(conversation.currentLeadId, updates);
    }
    if (!lead) {
      lead = await leadsService.createLead({
        leadType: 'sales_handover',
        whatsappNumber: from,
        contactId: conversation.contactId,
        customerName: contact.name,
        companyName: contact.companyName,
        requirement: requirement || undefined,
        handoverRequested: true,
        source: conversation.entrySource || 'whatsapp',
        notify: false, // alert is sent below with the handover reason
      });
      conversation.currentLeadId = lead.leadId;
    }

    await leadsService.notifySales(lead, 'Customer asked to talk to sales' + (requirement ? `: "${requirement}"` : ''));

    await stateManager.transition(conversation, FLOW, 'handed_over');
    await stateManager.setHumanOwner(conversation, 'pending_assignment');

    await AuditLog.create({
      whatsappNumber: from,
      contactId: conversation.contactId,
      eventType: 'human_takeover',
      meta: { leadId: lead.leadId, requirement },
      leadId: lead.leadId,
    });

    logger.info('Sales handover', { whatsappNumber: from, leadId: lead.leadId });
  } catch (err) {
    logger.error('Sales handover failed', { error: err.message, whatsappNumber: from });
  }

  // Always confirm to the customer, even if saving the lead failed
  const phone = config.store.salesPhone;
  await sendText(from,
    '✅ *You are now connected to our sales team.*\n\n' +
    'A sales executive will reply to you here shortly.' +
    (lead ? `\n\nReference: ${lead.leadId}` : '') +
    (phone ? `\n\nYou can also call us: ${phone}` : '') +
    `\n\nSales hours: ${config.support.hours}`);
}

module.exports = { handle, start };