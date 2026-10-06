'use strict';

const { sendText, sendButtons, sendList } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const ticketsService = require('../../services/support/ticketsService');

const CATEGORY_MAP = {
  comp_damaged: { category: 'damaged_item', label: 'Damaged Item' },
  comp_wrong: { category: 'wrong_item', label: 'Wrong Item Received' },
  comp_missing: { category: 'missing_item', label: 'Missing Item' },
  comp_return: { category: 'return_cancellation', label: 'Return / Cancellation' },
  comp_warranty: { category: 'warranty', label: 'Warranty Issue' },
  comp_other: { category: 'general_complaint', label: 'Other Complaint' },
};

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;
  const { from } = event;

  if (step === 'initial') {
    await sendList(from, {
      header: '🔄 Returns, Warranty & Complaints',
      body: 'Please select your issue type:',
      buttonLabel: 'Select Issue',
      sections: [{
        title: 'Issue Types',
        rows: [
          { id: 'comp_damaged', title: '📦 Damaged Item', description: 'Item arrived damaged' },
          { id: 'comp_wrong', title: '❌ Wrong Item', description: 'Received incorrect product' },
          { id: 'comp_missing', title: '🔍 Missing Item', description: 'Item not received or missing' },
          { id: 'comp_return', title: '↩️ Return / Cancel', description: 'Return or cancel order' },
          { id: 'comp_warranty', title: '🛡️ Warranty Issue', description: 'Product defect or warranty claim' },
          { id: 'comp_other', title: '💬 Other', description: 'Any other complaint' },
        ],
      }],
    });
    await stateManager.transition(conversation, 'complaint', 'awaiting_category');
    return;
  }

  if (step === 'awaiting_category') {
    const id = event.interactiveId || '';
    const mapped = CATEGORY_MAP[id];
    if (!mapped) {
      await sendText(from, 'Please select an issue type from the list.');
      return;
    }
    conversation.supportData = {
      ...conversation.supportData,
      issueCategory: mapped.category,
      issueCategoryLabel: mapped.label,
    };
    await stateManager.saveConversation(conversation);
    await sendText(from,
      `For *${mapped.label}*, please provide your *order reference number*:`
    );
    await stateManager.transition(conversation, 'complaint', 'awaiting_order_ref');
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
    await sendText(from, 'Please describe your issue briefly:');
    await stateManager.transition(conversation, 'complaint', 'awaiting_description');
    return;
  }

  if (step === 'awaiting_description') {
    const desc = (event.text || '').trim();
    if (!desc || desc.length < 5) {
      await sendText(from, 'Please describe your issue so we can help you.');
      return;
    }
    conversation.supportData = { ...conversation.supportData, issueDescription: desc };
    await stateManager.saveConversation(conversation);

    await sendButtons(from, {
      body:
        `Issue: *${conversation.supportData.issueCategoryLabel}*\n` +
        `Order: ${conversation.supportData.orderRef}\n` +
        `Description: ${desc}\n\n` +
        `Shall we raise a support ticket?`,
      buttons: [
        { id: 'comp_submit', title: 'Submit Ticket ✓' },
        { id: 'comp_cancel', title: 'Cancel' },
      ],
    });
    await stateManager.transition(conversation, 'complaint', 'confirm');
    return;
  }

  if (step === 'confirm') {
    const id = event.interactiveId || '';
    if (id === 'comp_cancel') {
      await sendText(from, 'Cancelled. Reply MENU to return to the main menu.');
      await stateManager.transition(conversation, 'welcome', 'main_menu');
      return;
    }
    if (id === 'comp_submit') {
      try {
        const s = conversation.supportData || {};
        const ticket = await ticketsService.createTicket({
          whatsappNumber: from,
          contactId: conversation.contactId,
          category: s.issueCategory || 'general_complaint',
          orderRef: s.orderRef,
          summary: `${s.issueCategoryLabel}: ${(s.issueDescription || '').substring(0, 100)}`,
          description: s.issueDescription,
        });

        conversation.currentTicketId = ticket.ticketId;
        await stateManager.transition(conversation, 'complaint', 'submitted');

        await sendButtons(from, {
          body:
            `✅ *Ticket raised!*\n\n` +
            `*Ticket: ${ticket.ticketId}*\n` +
            `Category: ${s.issueCategoryLabel}\n\n` +
            `Our team will review your case under the applicable policy.\n\n` +
            `⚠️ _No refund, replacement or pickup is confirmed until our team reviews the case. ' +
            'Please do not share banking details or passwords in this chat._`,
          buttons: [
            { id: 'menu_main', title: 'Main Menu' },
            { id: 'comp_human', title: 'Talk to Team' },
          ],
        });
      } catch {
        await sendText(from, '⚠️ Unable to create your ticket. Type HUMAN to reach our team.');
      }
    }
  }
}

module.exports = { handle };
