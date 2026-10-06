'use strict';

/**
 * Unit tests for multi-selection flow logic.
 * Tests the core selection state transitions without MongoDB.
 */

// Mock stateManager
const mockConversation = {
  selectedItems: [],
  selectedCategories: [],
  stepData: {},
  currentFlow: 'browse_products',
  currentStep: 'initial',
  save: jest.fn().mockResolvedValue(true),
};

const mockContact = { name: 'Test User', firstName: 'Test' };

// Mock dependencies before requiring flow
jest.mock('../../src/services/msg91/whatsappService', () => ({
  sendText: jest.fn().mockResolvedValue({}),
  sendList: jest.fn().mockResolvedValue({}),
  sendButtons: jest.fn().mockResolvedValue({}),
  sendAddAnotherOrDone: jest.fn().mockResolvedValue({}),
  sendMainMenu: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/services/catalogue/catalogueService', () => ({
  getCategories: jest.fn().mockResolvedValue([
    { key: 'office_chairs', label: 'Office Chairs', emoji: '🪑', displayOrder: 1 },
    { key: 'office_desks', label: 'Office Desks & Tables', emoji: '🖥️', displayOrder: 2 },
    { key: 'workstations', label: 'Workstations', emoji: '💼', displayOrder: 3 },
    { key: 'storage', label: 'Storage & Cabinets', emoji: '🗄️', displayOrder: 4 },
    { key: 'accessories', label: 'Office Accessories', emoji: '📎', displayOrder: 5 },
    { key: 'complete_setup', label: 'Complete Office Setup', emoji: '🏢', displayOrder: 6 },
    { key: 'something_else', label: 'Something Else', emoji: '💬', displayOrder: 7 },
  ]),
}));

jest.mock('../../src/conversation/stateManager', () => ({
  saveConversation: jest.fn().mockImplementation(async (conv) => conv),
  transition: jest.fn().mockImplementation(async (conv, flow, step) => {
    conv.currentFlow = flow;
    conv.currentStep = step;
    return conv;
  }),
}));

// Mock quoteFlow to avoid circular dep in tests
jest.mock('../../src/conversation/flows/quoteFlow', () => ({
  handle: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/conversation/flows/supportFlow', () => ({
  handle: jest.fn().mockResolvedValue({}),
}));

const whatsappService = require('../../src/services/msg91/whatsappService');
const stateManager = require('../../src/conversation/stateManager');
const productFlow = require('../../src/conversation/flows/productFlow');

function makeEvent(overrides = {}) {
  return {
    from: '919876543210',
    type: 'interactive',
    text: null,
    interactiveId: null,
    interactiveTitle: null,
    ...overrides,
  };
}

function resetConversation() {
  mockConversation.selectedItems = [];
  mockConversation.selectedCategories = [];
  mockConversation.stepData = {};
  mockConversation.currentFlow = 'browse_products';
  mockConversation.currentStep = 'initial';
  jest.clearAllMocks();
}

describe('Product Multi-Selection Flow', () => {
  beforeEach(resetConversation);

  test('initial step shows category list', async () => {
    await productFlow.handle(makeEvent(), mockConversation, mockContact);
    expect(whatsappService.sendList).toHaveBeenCalledTimes(1);
    const callArgs = whatsappService.sendList.mock.calls[0][1];
    expect(callArgs.sections[0].rows.length).toBeGreaterThan(0);
    expect(stateManager.transition).toHaveBeenCalledWith(
      mockConversation, 'browse_products', 'awaiting_category_selection'
    );
  });

  test('category selection with valid ID stores pending category and asks quantity', async () => {
    mockConversation.currentStep = 'awaiting_category_selection';
    await productFlow.handle(
      makeEvent({ interactiveId: 'cat_office_chairs' }),
      mockConversation,
      mockContact
    );
    expect(mockConversation.stepData.pendingCategoryKey).toBe('office_chairs');
    expect(mockConversation.stepData.pendingCategoryLabel).toBe('Office Chairs');
    expect(whatsappService.sendButtons).toHaveBeenCalledTimes(1);
    expect(stateManager.transition).toHaveBeenCalledWith(
      mockConversation, 'browse_products', 'awaiting_quantity'
    );
  });

  test('invalid quantity shows error prompt', async () => {
    mockConversation.currentStep = 'awaiting_quantity';
    mockConversation.stepData = { pendingCategoryKey: 'office_chairs', pendingCategoryLabel: 'Office Chairs' };
    await productFlow.handle(makeEvent({ text: 'not a number', type: 'text' }), mockConversation, mockContact);
    expect(whatsappService.sendButtons).toHaveBeenCalledTimes(1);
    // Should not advance step
    expect(stateManager.transition).not.toHaveBeenCalled();
    expect(mockConversation.selectedItems).toHaveLength(0);
  });

  test('valid quantity adds item and shows Add Another/Done', async () => {
    mockConversation.currentStep = 'awaiting_quantity';
    mockConversation.stepData = { pendingCategoryKey: 'office_chairs', pendingCategoryLabel: 'Office Chairs' };
    await productFlow.handle(makeEvent({ text: '50', type: 'text' }), mockConversation, mockContact);
    expect(mockConversation.selectedItems).toHaveLength(1);
    expect(mockConversation.selectedItems[0].categoryKey).toBe('office_chairs');
    expect(mockConversation.selectedItems[0].quantity).toBe(50);
    expect(mockConversation.selectedCategories).toContain('office_chairs');
    expect(whatsappService.sendAddAnotherOrDone).toHaveBeenCalledTimes(1);
  });

  test('skip quantity adds item without quantity', async () => {
    mockConversation.currentStep = 'awaiting_quantity';
    mockConversation.stepData = { pendingCategoryKey: 'office_desks', pendingCategoryLabel: 'Office Desks & Tables' };
    await productFlow.handle(
      makeEvent({ interactiveId: 'qty_skip' }),
      mockConversation,
      mockContact
    );
    expect(mockConversation.selectedItems).toHaveLength(1);
    expect(mockConversation.selectedItems[0].quantity).toBeNull();
  });

  test('Add Another shows list without already-selected categories', async () => {
    mockConversation.currentStep = 'awaiting_add_or_done';
    mockConversation.selectedItems = [{ categoryKey: 'office_chairs', categoryLabel: 'Office Chairs', quantity: 50 }];
    mockConversation.selectedCategories = ['office_chairs'];

    await productFlow.handle(
      makeEvent({ interactiveId: 'add_another' }),
      mockConversation,
      mockContact
    );

    expect(whatsappService.sendList).toHaveBeenCalledTimes(1);
    const rows = whatsappService.sendList.mock.calls[0][1].sections[0].rows;
    // office_chairs should NOT appear in available list
    const rowIds = rows.map((r) => r.id);
    expect(rowIds).not.toContain('cat_office_chairs');
    expect(rowIds).toContain('cat_office_desks');
  });

  test('Done with selections shows summary', async () => {
    mockConversation.currentStep = 'awaiting_add_or_done';
    mockConversation.selectedItems = [
      { categoryKey: 'office_chairs', categoryLabel: 'Office Chairs', quantity: 50 },
      { categoryKey: 'office_desks', categoryLabel: 'Office Desks & Tables', quantity: 20 },
    ];
    mockConversation.selectedCategories = ['office_chairs', 'office_desks'];

    await productFlow.handle(
      makeEvent({ interactiveId: 'done_selection' }),
      mockConversation,
      mockContact
    );

    expect(whatsappService.sendButtons).toHaveBeenCalledTimes(1);
    const bodyText = whatsappService.sendButtons.mock.calls[0][1].body;
    expect(bodyText).toContain('Office Chairs');
    expect(bodyText).toContain('Office Desks & Tables');
    expect(bodyText).toContain('50');
    expect(bodyText).toContain('20');
  });

  test('Done with empty selection shows error and resets', async () => {
    mockConversation.currentStep = 'awaiting_add_or_done';
    mockConversation.selectedItems = [];
    mockConversation.selectedCategories = [];
    await productFlow.handle(
      makeEvent({ interactiveId: 'done_selection' }),
      mockConversation,
      mockContact
    );
    expect(whatsappService.sendText).toHaveBeenCalledTimes(1);
  });

  test('previously selected category not shown again', async () => {
    // Simulate being mid-flow with some items already selected and "Add Another" tapped
    mockConversation.currentStep = 'awaiting_add_or_done';
    mockConversation.selectedItems = [
      { categoryKey: 'office_chairs', categoryLabel: 'Office Chairs', quantity: 10 },
      { categoryKey: 'office_desks', categoryLabel: 'Office Desks & Tables', quantity: 5 },
      { categoryKey: 'workstations', categoryLabel: 'Workstations', quantity: 3 },
    ];
    mockConversation.selectedCategories = ['office_chairs', 'office_desks', 'workstations'];
    // Trigger "Add Another" which shows the filtered list
    await productFlow.handle(makeEvent({ interactiveId: 'add_another' }), mockConversation, mockContact);
    const rows = whatsappService.sendList.mock.calls[0][1].sections[0].rows;
    const rowIds = rows.map((r) => r.id);
    expect(rowIds).not.toContain('cat_office_chairs');
    expect(rowIds).not.toContain('cat_office_desks');
    expect(rowIds).not.toContain('cat_workstations');
    expect(rowIds).toContain('cat_storage');
    expect(rowIds).toContain('cat_accessories');
  });
});
