'use strict';

const { sendText, sendButtons, sendList } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const leadsService = require('../../services/leads/leadsService');
const ticketsService = require('../../services/support/ticketsService');
const AuditLog = require('../../models/AuditLog');
const config = require('../../config');
const logger = require('../../utils/logger');

const TEAM_MAP = {
  support_product: { label: 'Product / Sales', leadType: 'general' },
  support_bulk: { label: 'Bulk Office Setup', leadType: 'bulk_office' },
  support_delivery: { label: 'Delivery', leadType: 'general' },
  support_order: { label: 'Order / Payment', leadType: 'general' },
  support_invoice: { label: 'Invoice / Billing', leadType: 'general' },
  support_return: { label: 'Return / Warranty', leadType: 'general' },
  support_other: { label: 'Other', leadType: 'general' },
  human_sales: { label: 'Sales / Products', leadType: 'general' },
  human_support: { label: 'Order Support', leadType: 'general' },
  human_other: { label: 'General Support', leadType: 'general' },
};

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;
  const { from } = event;

  if (step === 'initial' || step === 'choose_team') {
    await sendList(from, {
      header: '👤 Talk to Our Team',
      body: 'Please select the team you need:',
      buttonLabel: 'Select Team',
      sections: [{
        title: 'Teams',
        rows: [
          { id: 'human_sales', title: '🛍️ Sales / Products', description: 'Pre-sales and product questions' },
          { id: 'support_bulk', title: '🏢 Bulk Office Setup', description: 'Large or project orders' },
          { id: 'support_delivery', title: '🚚 Delivery', description: 'Delivery and logistics' },
          { id: 'support_order', title: '📦 Order / Payment', description: 'Order or payment issues' },
          { id: 'support_invoice', title: '🧾 Invoice', description: 'Billing or GST help' },
          { id: 'support_return', title: '🔄 Return / Warranty', description: 'Returns and warranty claims' },
          { id: 'support_other', title: '💬 Other', description: 'Any other query' },
        ],
      }],
    });
    await stateManager.transition(conversation, 'human_handoff', 'choose_category');
    return;
  }

  if (step === 'choose_category') {
    const id = event.interactiveId || '';
    const team = TEAM_MAP[id];

    if (!team) {
      await sendText(from, 'Please select a team from the list.');
      return;
    }

    conversation.supportData = {
      ...conversation.supportData,
      teamSelected: team.label,
    };
    await stateManager.saveConversation(conversation);

    await sendText(from, 'Please briefly describe how we can help you:');
    await stateManager.transition(conversation, 'human_handoff', 'awaiting_description');
    return;
  }

  if (step === 'awaiting_description') {
    const desc = (event.text || '').trim();
    if (!desc || desc.length < 3) {
      await sendText(from, 'Please describe how we can help:');
      return;
    }

    conversation.supportData = {
      ...conversation.supportData,
      issueDescription: desc,
    };
    await stateManager.saveConversation(conversation);

    try {
      // Create a lead/ticket
      const lead = await leadsService.createLead({
        leadType: 'general',
        whatsappNumber: from,
        contactId: conversation.contactId,
        customerName: contact.name,
        companyName: contact.companyName,
        notes: `Team: ${conversation.supportData.teamSelected}. ${desc}`,
        source: conversation.entrySource || 'whatsapp',
      });

      // Mark conversation as human-owned
      await stateManager.setHumanOwner(conversation, 'pending_assignment');

      await AuditLog.create({
        whatsappNumber: from,
        contactId: conversation.contactId,
        eventType: 'human_takeover',
        meta: { team: conversation.supportData.teamSelected, leadId: lead.leadId },
        leadId: lead.leadId,
      });

      logger.info('Human handoff initiated', {
        whatsappNumber: from,
        team: conversation.supportData.teamSelected,
        leadId: lead.leadId,
      });

      await sendText(from,
        `✅ *Got it!* We've recorded your request.\n\n` +
        `Team: *${conversation.supportData.teamSelected}*\n` +
        `Reference: ${lead.leadId}\n\n` +
        `A team member will be in touch with you.\n` +
        `Support hours: ${config.support.hours}\n\n` +
        `_Please do not share passwords, OTPs or banking details in this chat._`
      );
    } catch (err) {
      logger.error('Human handoff lead creation failed', { error: err.message });
      await sendText(from,
        `We've noted your request. A team member will contact you shortly.\n` +
        `You can also reach us at: ${config.support.phone} | ${config.support.email}`
      );
    }
  }
}

module.exports = { handle };
