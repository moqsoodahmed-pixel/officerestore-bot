'use strict';

const { sendMainMenu, sendText, sendButtons, sendList } = require('../services/msg91/whatsappService');
const stateManager = require('./stateManager');
const Contact = require('../models/Contact');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const config = require('../config');

const COMMANDS = {
  MENU: /^menu$/i,
  BACK: /^back$/i,
  SUPPORT: /^support$/i,
  HUMAN: /^human$/i,
  STOP: /^stop$/i,
  HI: /^(hi|hello|hey|halo|namaste|start)$/i,
};

/**
 * Detect if the text is a global command.
 * Returns the command name or null.
 */
function detectCommand(text) {
  if (!text) return null;
  const t = text.trim().toUpperCase();
  for (const [cmd, regex] of Object.entries(COMMANDS)) {
    if (regex.test(text.trim())) return cmd;
  }
  return null;
}

/**
 * Handle a global command.
 * Returns true if handled, false if not a command.
 */
async function handleCommand(command, event, conversation, contact) {
  const { from } = event;

  switch (command) {
    case 'MENU':
    case 'HI': {
      await stateManager.resetToMenu(conversation);
      const greeting = `Hello${contact.firstName ? ` ${contact.firstName}` : ''}! 👋 Welcome to *Officerestore*.\n\nWe help you find office furniture and workplace essentials for your business or workspace.`;
      await sendMainMenu(from, greeting);
      return true;
    }

    case 'BACK': {
      const wentBack = await stateManager.goBack(conversation);
      if (!wentBack) {
        await stateManager.resetToMenu(conversation);
        await sendMainMenu(from);
      } else {
        // Re-enter previous flow at previous step
        // Let flow router handle it on next message — send a nudge
        await sendText(from, 'Going back... Type anything or use MENU to return to the main menu.');
      }
      return true;
    }

    case 'SUPPORT': {
      await sendList(from, {
        header: '🆘 Support',
        body: 'Please select what you need help with:',
        buttonLabel: 'Choose',
        sections: [{
          title: 'Support Options',
          rows: [
            { id: 'support_product', title: 'Product / Sales', description: 'Pre-sales questions' },
            { id: 'support_bulk', title: 'Bulk Office Setup', description: 'Large or project orders' },
            { id: 'support_delivery', title: 'Delivery', description: 'Delivery queries' },
            { id: 'support_order', title: 'Order / Payment', description: 'Order status or payment' },
            { id: 'support_invoice', title: 'Invoice', description: 'Billing or GST help' },
            { id: 'support_return', title: 'Return / Warranty', description: 'Returns and warranty claims' },
            { id: 'support_other', title: 'Other', description: 'Anything else' },
          ],
        }],
      });
      await stateManager.transition(conversation, 'support', 'choose_category');
      return true;
    }

    case 'HUMAN': {
      await sendButtons(from, {
        body: '👤 Connecting you to our team.\n\nPlease select the team you need:',
        buttons: [
          { id: 'human_sales', title: 'Sales / Products' },
          { id: 'human_support', title: 'Order Support' },
          { id: 'human_other', title: 'Other' },
        ],
      });
      await stateManager.transition(conversation, 'human_handoff', 'choose_team');
      return true;
    }

    case 'STOP': {
      // Immediately suppress marketing; record consent
      const contact_ = await Contact.findOneAndUpdate(
        { whatsappNumber: from },
        {
          $set: {
            'consent.optOutStatus': true,
            'consent.optOutAt': new Date(),
            'consent.optOutSource': 'whatsapp_stop_command',
            'consent.marketingOptIn': false,
          },
        },
        { new: true }
      );

      await AuditLog.create({
        whatsappNumber: from,
        contactId: contact_?._id,
        eventType: 'opt_out',
        meta: { source: 'STOP_command' },
      });

      conversation.status = 'opted_out';
      await stateManager.saveConversation(conversation);

      await sendText(
        from,
        '✅ You have been opted out of promotional messages from Officerestore.\n\n' +
        'We will not send you marketing messages. You can still contact us for service support.\n\n' +
        `Support: ${config.support.phone} | ${config.support.email}`
      );

      logger.info('Customer opted out', { whatsappNumber: from });
      return true;
    }

    default:
      return false;
  }
}

module.exports = { detectCommand, handleCommand };
