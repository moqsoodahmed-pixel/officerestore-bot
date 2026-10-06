'use strict';

const { sendText, sendButtons, sendList } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const ticketsService = require('../../services/support/ticketsService');

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;
  const { from } = event;

  if (step === 'initial') {
    await sendList(from, {
      header: '🧾 Invoice / GST Details',
      body: 'Please select what you need:',
      buttonLabel: 'Choose',
      sections: [{
        title: 'Billing & Invoice',
        rows: [
          { id: 'inv_request', title: 'Request Invoice', description: 'Get a copy of your invoice' },
          { id: 'inv_update', title: 'Update Billing Details', description: 'Change billing name or GST' },
          { id: 'inv_gst', title: 'GST Invoice Enquiry', description: 'GST invoice or GSTIN questions' },
          { id: 'inv_other', title: 'Other Billing Issue', description: 'Any other billing query' },
        ],
      }],
    });
    await stateManager.transition(conversation, 'invoice', 'awaiting_type');
    return;
  }

  if (step === 'awaiting_type') {
    const id = event.interactiveId || '';
    const typeMap = {
      inv_request: 'Invoice Request',
      inv_update: 'Billing Details Update',
      inv_gst: 'GST Invoice Enquiry',
      inv_other: 'Other Billing Issue',
    };
    const issueType = typeMap[id] || 'Billing Query';
    conversation.supportData = { ...conversation.supportData, issueCategory: 'invoice', issueDescription: issueType };
    await stateManager.saveConversation(conversation);

    await sendText(from,
      `For *${issueType}*, please provide your *order reference number* or *order ID*.\n\n` +
      '_Note: Invoice details are shared only after identity verification by our team. ' +
      'Please do not share passwords, OTPs or card details in this chat._'
    );
    await stateManager.transition(conversation, 'invoice', 'awaiting_order_ref');
    return;
  }

  if (step === 'awaiting_order_ref') {
    const orderRef = (event.text || '').trim();
    if (!orderRef || orderRef.length < 3) {
      await sendText(from, 'Please provide a valid order reference number.');
      return;
    }

    conversation.supportData = { ...conversation.supportData, orderRef };
    await stateManager.saveConversation(conversation);

    try {
      const ticket = await ticketsService.createTicket({
        whatsappNumber: from,
        contactId: conversation.contactId,
        category: 'invoice',
        orderRef,
        summary: conversation.supportData.issueDescription || 'Invoice Query',
        description: `Customer ${contact.name || from} requested ${conversation.supportData.issueDescription} for order ${orderRef}`,
      });

      conversation.currentTicketId = ticket.ticketId;
      await stateManager.transition(conversation, 'invoice', 'submitted');

      await sendButtons(from, {
        body:
          `✅ *Ticket raised!*\n\n` +
          `*Ticket: ${ticket.ticketId}*\n` +
          `Category: Invoice / Billing\n\n` +
          `Our team will verify your identity and provide the requested invoice details.\n\n` +
          `_Please do not share passwords, OTPs, CVV or card details in this chat._`,
        buttons: [
          { id: 'menu_main', title: 'Main Menu' },
          { id: 'invoice_human', title: 'Talk to Team' },
        ],
      });
    } catch {
      await sendText(from, '⚠️ Unable to create your ticket. Please type HUMAN to speak with our team.');
    }
  }
}

module.exports = { handle };
