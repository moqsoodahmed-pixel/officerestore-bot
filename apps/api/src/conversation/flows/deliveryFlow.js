'use strict';

const { sendText, sendButtons, sendList } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;
  const { from } = event;

  if (step === 'initial') {
    await sendList(from, {
      header: '🚚 Delivery & Installation',
      body: 'Please select what you need help with:',
      buttonLabel: 'Choose',
      sections: [{
        title: 'Options',
        rows: [
          { id: 'del_availability', title: 'Delivery Availability', description: 'Check if we deliver to your area' },
          { id: 'del_installation', title: 'Installation', description: 'Professional installation info' },
          { id: 'del_charges', title: 'Delivery Charges', description: 'Shipping and handling fees' },
          { id: 'del_timeline', title: 'Delivery Timeline', description: 'Estimated delivery dates' },
        ],
      }],
    });
    await stateManager.transition(conversation, 'delivery', 'awaiting_sub_type');
    return;
  }

  if (step === 'awaiting_sub_type') {
    const id = event.interactiveId || '';
    const subTypeMap = {
      del_availability: 'Delivery Availability',
      del_installation: 'Installation',
      del_charges: 'Delivery Charges',
      del_timeline: 'Delivery Timeline',
    };
    const subType = subTypeMap[id] || 'General Delivery Query';
    conversation.deliveryQuery = { subType };
    await stateManager.saveConversation(conversation);
    await sendText(from, `For *${subType}*, please enter your *delivery PIN code* (6 digits):`);
    await stateManager.transition(conversation, 'delivery', 'ask_pin');
    return;
  }

  if (step === 'ask_pin') {
    const pin = (event.text || '').trim().replace(/\D/g, '');
    if (pin.length !== 6) {
      await sendText(from, 'Please enter a valid 6-digit PIN code:');
      return;
    }
    conversation.deliveryQuery = { ...conversation.deliveryQuery, deliveryPin: pin };
    await stateManager.saveConversation(conversation);

    // Always route to team for confirmed information
    const subType = conversation.deliveryQuery?.subType || 'Delivery Query';
    await sendButtons(from, {
      body:
        `Thank you! For *${subType}* to PIN *${pin}*:\n\n` +
        'Our team will verify and confirm delivery coverage, charges and timelines for your area.\n\n' +
        '_We only share verified information. Estimated delivery dates are confirmed by our logistics team._',
      buttons: [
        { id: 'del_quote', title: 'Get a Quote' },
        { id: 'del_human', title: 'Talk to Team' },
        { id: 'del_menu', title: 'Main Menu' },
      ],
    });
    await stateManager.transition(conversation, 'delivery', 'awaiting_action');
    return;
  }

  if (step === 'awaiting_action') {
    const id = event.interactiveId || '';
    if (id === 'del_quote') {
      await stateManager.transition(conversation, 'quote', 'initial');
      return require('./quoteFlow').handle(event, conversation, contact);
    }
    if (id === 'del_human') {
      await stateManager.transition(conversation, 'human_handoff', 'initial');
      return require('./supportFlow').handle(event, conversation, contact);
    }
    // Default: menu
    await stateManager.transition(conversation, 'welcome', 'main_menu');
    return require('./welcomeFlow').handle(event, conversation, contact);
  }
}

module.exports = { handle };
