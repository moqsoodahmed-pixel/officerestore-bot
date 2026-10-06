'use strict';

const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Load or create a conversation state for a given WhatsApp number.
 * Also upserts the Contact record.
 */
async function loadOrCreate(whatsappNumber, senderName) {
  // Upsert contact
  const contact = await Contact.findOneAndUpdate(
    { whatsappNumber },
    {
      $setOnInsert: { whatsappNumber },
      $set: {
        lastSeenAt: new Date(),
        ...(senderName && { name: senderName, firstName: senderName.split(' ')[0] }),
      },
    },
    { upsert: true, new: true }
  );

  // Load or create conversation
  let conversation = await Conversation.findOne({ whatsappNumber });

  if (!conversation) {
    conversation = await Conversation.create({
      whatsappNumber,
      contactId: contact._id,
      currentFlow: 'idle',
      currentStep: 'initial',
      owner: 'BOT',
      status: 'active',
      lastMessageAt: new Date(),
    });
    logger.info('New conversation created', { whatsappNumber });
  } else {
    // Check timeout
    const idleMs = Date.now() - new Date(conversation.lastMessageAt).getTime();
    const timeoutMs = config.conversation.timeoutSeconds * 1000;
    if (idleMs > timeoutMs && conversation.status === 'active') {
      conversation.status = 'timed_out';
      conversation.currentFlow = 'idle';
      conversation.currentStep = 'initial';
      conversation.selectedItems = [];
      conversation.selectedCategories = [];
      conversation.stepData = {};
      await conversation.save();
      logger.info('Conversation timed out and reset', { whatsappNumber });
    }
    // Update last seen
    conversation.lastMessageAt = new Date();
    conversation.status = 'active';
    if (senderName && !contact.name) contact.name = senderName;
    await Promise.all([conversation.save(), contact.save()]);
  }

  return { conversation, contact };
}

async function saveConversation(conversation) {
  conversation.lastMessageAt = new Date();
  return conversation.save();
}

/**
 * Transition the conversation to a new flow and step.
 */
async function transition(conversation, flow, step) {
  conversation.previousFlow = conversation.currentFlow;
  conversation.previousStep = conversation.currentStep;
  conversation.currentFlow = flow;
  conversation.currentStep = step;
  await saveConversation(conversation);
}

/**
 * Go back one step (BACK command).
 */
async function goBack(conversation) {
  if (conversation.previousFlow && conversation.previousStep) {
    const tmp = { flow: conversation.currentFlow, step: conversation.currentStep };
    conversation.currentFlow = conversation.previousFlow;
    conversation.currentStep = conversation.previousStep;
    conversation.previousFlow = tmp.flow;
    conversation.previousStep = tmp.step;
    await saveConversation(conversation);
    return true;
  }
  return false;
}

/**
 * Reset conversation to main menu state.
 */
async function resetToMenu(conversation) {
  conversation.previousFlow = conversation.currentFlow;
  conversation.previousStep = conversation.currentStep;
  conversation.currentFlow = 'welcome';
  conversation.currentStep = 'main_menu';
  await saveConversation(conversation);
}

/**
 * Set human takeover.
 */
async function setHumanOwner(conversation, agentId) {
  conversation.owner = 'HUMAN';
  conversation.assignedAgentId = agentId || 'unassigned';
  conversation.humanTookOverAt = new Date();
  await saveConversation(conversation);
}

/**
 * Release back to bot.
 */
async function setBotOwner(conversation) {
  conversation.owner = 'BOT';
  conversation.assignedAgentId = null;
  await saveConversation(conversation);
}

module.exports = {
  loadOrCreate,
  saveConversation,
  transition,
  goBack,
  resetToMenu,
  setHumanOwner,
  setBotOwner,
};
