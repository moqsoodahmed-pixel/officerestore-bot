'use strict';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockMessage = { processed: false, status: 'received', save: jest.fn().mockResolvedValue(true) };
const mockConversation = {
  _id: 'conv-001',
  whatsappNumber: '919876543210',
  currentFlow: 'idle',
  currentStep: 'initial',
  owner: 'BOT',
  stepData: {},
  selectedItems: [],
  selectedCategories: [],
  save: jest.fn().mockResolvedValue(true),
};
const mockContact = {
  _id: 'contact-001',
  name: 'Test User',
  firstName: 'Test',
  consent: { optOutStatus: false },
};

jest.mock('../../src/models/Message', () => ({
  findOne: jest.fn(),
  create: jest.fn().mockResolvedValue({ ...mockMessage }),
}));

jest.mock('../../src/models/AuditLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/conversation/stateManager', () => ({
  loadOrCreate: jest.fn().mockResolvedValue({
    conversation: mockConversation,
    contact: mockContact,
  }),
  saveConversation: jest.fn().mockResolvedValue(mockConversation),
  transition: jest.fn().mockResolvedValue(mockConversation),
  resetToMenu: jest.fn().mockResolvedValue(mockConversation),
  goBack: jest.fn().mockResolvedValue(true),
  setHumanOwner: jest.fn().mockResolvedValue(mockConversation),
  setBotOwner: jest.fn().mockResolvedValue(mockConversation),
}));

jest.mock('../../src/conversation/flowRouter', () => ({
  route: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/services/msg91/whatsappService', () => ({
  sendText: jest.fn().mockResolvedValue({}),
  sendButtons: jest.fn().mockResolvedValue({}),
  sendMainMenu: jest.fn().mockResolvedValue({}),
  sendList: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/models/Contact', () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue(mockContact),
}));

const Message = require('../../src/models/Message');
const stateManager = require('../../src/conversation/stateManager');
const flowRouter = require('../../src/conversation/flowRouter');
const whatsapp = require('../../src/services/msg91/whatsappService');
const { processEvent } = require('../../src/conversation/conversationEngine');

function makeEvent(overrides = {}) {
  return {
    eventId: 'evt-001',
    messageId: 'msg-001',
    from: '919876543210',
    type: 'text',
    text: 'Hello',
    interactiveId: null,
    interactiveTitle: null,
    senderName: 'Test User',
    timestamp: new Date(),
    raw: {},
    ...overrides,
  };
}

describe('Conversation Engine — Deduplication', () => {
  beforeEach(() => jest.clearAllMocks());

  test('skips already-processed message (duplicate)', async () => {
    Message.findOne.mockResolvedValueOnce({ processed: true, providerMessageId: 'msg-001' });
    await processEvent(makeEvent());
    expect(flowRouter.route).not.toHaveBeenCalled();
    expect(Message.create).not.toHaveBeenCalled();
  });

  test('processes new message (not duplicate)', async () => {
    Message.findOne.mockResolvedValueOnce(null); // not a duplicate
    await processEvent(makeEvent({ text: 'random text' }));
    expect(Message.create).toHaveBeenCalledTimes(1);
    expect(flowRouter.route).toHaveBeenCalledTimes(1);
  });
});

describe('Conversation Engine — HUMAN ownership', () => {
  beforeEach(() => jest.clearAllMocks());

  test('does not auto-reply when conversation is owned by HUMAN', async () => {
    Message.findOne.mockResolvedValueOnce(null);
    const humanConv = { ...mockConversation, owner: 'HUMAN' };
    stateManager.loadOrCreate.mockResolvedValueOnce({
      conversation: humanConv,
      contact: mockContact,
    });

    await processEvent(makeEvent({ text: 'Where is my order?' }));

    // Bot should NOT reply
    expect(flowRouter.route).not.toHaveBeenCalled();
    expect(whatsapp.sendText).not.toHaveBeenCalled();
    expect(whatsapp.sendButtons).not.toHaveBeenCalled();
  });

  test('processes normally when conversation is owned by BOT', async () => {
    Message.findOne.mockResolvedValueOnce(null);
    stateManager.loadOrCreate.mockResolvedValueOnce({
      conversation: { ...mockConversation, owner: 'BOT' },
      contact: mockContact,
    });

    await processEvent(makeEvent({ text: 'not a command' }));
    expect(flowRouter.route).toHaveBeenCalledTimes(1);
  });
});

describe('Conversation Engine — Global Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Message.findOne.mockResolvedValue(null);
    stateManager.loadOrCreate.mockResolvedValue({
      conversation: { ...mockConversation, owner: 'BOT' },
      contact: mockContact,
    });
  });

  test('MENU command triggers resetToMenu and main menu', async () => {
    await processEvent(makeEvent({ text: 'MENU' }));
    expect(stateManager.resetToMenu).toHaveBeenCalled();
    expect(whatsapp.sendMainMenu).toHaveBeenCalled();
    expect(flowRouter.route).not.toHaveBeenCalled();
  });

  test('menu command is case-insensitive', async () => {
    await processEvent(makeEvent({ text: 'menu' }));
    expect(stateManager.resetToMenu).toHaveBeenCalled();
  });

  test('BACK command calls goBack', async () => {
    await processEvent(makeEvent({ text: 'BACK' }));
    expect(stateManager.goBack).toHaveBeenCalled();
    expect(flowRouter.route).not.toHaveBeenCalled();
  });

  test('HUMAN command transitions to human_handoff flow', async () => {
    await processEvent(makeEvent({ text: 'HUMAN' }));
    expect(stateManager.transition).toHaveBeenCalledWith(
      expect.any(Object), 'human_handoff', 'choose_team'
    );
    expect(flowRouter.route).not.toHaveBeenCalled();
  });

  test('STOP records opt-out and does not route to flow', async () => {
    await processEvent(makeEvent({ text: 'STOP' }));
    expect(flowRouter.route).not.toHaveBeenCalled();
    // Should send a confirmation message
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
    const msg = whatsapp.sendText.mock.calls[0][1];
    expect(msg).toContain('opted out');
  });

  test('Non-command text routes to flow', async () => {
    await processEvent(makeEvent({ text: 'I need 50 office chairs' }));
    expect(flowRouter.route).toHaveBeenCalledTimes(1);
    expect(stateManager.resetToMenu).not.toHaveBeenCalled();
  });
});

describe('Conversation Engine — Error Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Message.findOne.mockResolvedValue(null);
    stateManager.loadOrCreate.mockResolvedValue({
      conversation: { ...mockConversation, owner: 'BOT', save: jest.fn() },
      contact: mockContact,
    });
  });

  test('sends customer-friendly fallback on flow error', async () => {
    flowRouter.route.mockRejectedValueOnce(new Error('Simulated internal error'));
    await processEvent(makeEvent({ text: 'trigger error' }));
    expect(whatsapp.sendButtons).toHaveBeenCalledTimes(1);
    const body = whatsapp.sendButtons.mock.calls[0][1].body;
    expect(body).not.toContain('Simulated internal error'); // Never expose technical errors
    expect(body.toLowerCase()).toContain('sorry');
  });
});
