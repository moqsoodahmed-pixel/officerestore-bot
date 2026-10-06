'use strict';

// Mock mongoose models before importing services
jest.mock('../../src/models/Lead', () => {
  const mockLead = { leadId: 'LEAD-TEST-001', status: 'new' };
  return {
    create: jest.fn().mockResolvedValue(mockLead),
    findOneAndUpdate: jest.fn().mockResolvedValue(mockLead),
    find: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockResolvedValue(5),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([mockLead]),
    findOne: jest.fn().mockResolvedValue(mockLead),
  };
});

jest.mock('../../src/models/Quote', () => {
  const mockQuote = { quoteId: 'QUO-TEST-001', status: 'pending_review' };
  return {
    create: jest.fn().mockResolvedValue(mockQuote),
    findOneAndUpdate: jest.fn().mockResolvedValue(mockQuote),
    find: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockResolvedValue(3),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([mockQuote]),
    findOne: jest.fn().mockResolvedValue(mockQuote),
  };
});

jest.mock('../../src/models/Ticket', () => {
  const mockTicket = { ticketId: 'TKT-TEST-001', status: 'open' };
  return {
    create: jest.fn().mockResolvedValue(mockTicket),
    findOneAndUpdate: jest.fn().mockResolvedValue(mockTicket),
    find: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockResolvedValue(2),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([mockTicket]),
    findOne: jest.fn().mockResolvedValue(mockTicket),
  };
});

jest.mock('../../src/models/AuditLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const Lead = require('../../src/models/Lead');
const Quote = require('../../src/models/Quote');
const Ticket = require('../../src/models/Ticket');
const leadsService = require('../../src/services/leads/leadsService');
const quotesService = require('../../src/services/quotes/quotesService');
const ticketsService = require('../../src/services/support/ticketsService');

// ─── Leads ─────────────────────────────────────────────────────────────────────

describe('leadsService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createLead calls Lead.create with correct fields', async () => {
    const data = {
      leadType: 'bulk_office',
      whatsappNumber: '919876543210',
      customerName: 'Test User',
      items: [{ categoryKey: 'office_chairs', quantity: 50 }],
      deliveryPin: '560001',
    };
    const result = await leadsService.createLead(data);
    expect(Lead.create).toHaveBeenCalledTimes(1);
    const callArg = Lead.create.mock.calls[0][0];
    expect(callArg.leadType).toBe('bulk_office');
    expect(callArg.whatsappNumber).toBe('919876543210');
    expect(callArg.deliveryPin).toBe('560001');
    expect(callArg.status).toBe('new');
    expect(result.leadId).toBeDefined();
  });

  test('createLead generates unique leadId', async () => {
    Lead.create.mockImplementation(async (data) => ({ ...data }));
    const r1 = await leadsService.createLead({ whatsappNumber: '1', leadType: 'general' });
    const r2 = await leadsService.createLead({ whatsappNumber: '2', leadType: 'general' });
    expect(r1.leadId).not.toBe(r2.leadId);
  });

  test('updateLead calls findOneAndUpdate', async () => {
    await leadsService.updateLead('LEAD-001', { status: 'assigned' });
    expect(Lead.findOneAndUpdate).toHaveBeenCalledWith(
      { leadId: 'LEAD-001' },
      { $set: { status: 'assigned' } },
      { new: true }
    );
  });
});

// ─── Quotes ────────────────────────────────────────────────────────────────────

describe('quotesService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createQuoteRequest creates quote with items', async () => {
    const data = {
      whatsappNumber: '919876543210',
      items: [
        { categoryKey: 'office_chairs', categoryLabel: 'Office Chairs', quantity: 50 },
        { categoryKey: 'office_desks', categoryLabel: 'Office Desks', quantity: 20 },
      ],
      quoteData: { deliveryPin: '560001', billingType: 'business' },
    };
    await quotesService.createQuoteRequest(data);
    expect(Quote.create).toHaveBeenCalledTimes(1);
    const callArg = Quote.create.mock.calls[0][0];
    expect(callArg.items).toHaveLength(2);
    expect(callArg.items[0].quantity).toBe(50);
    expect(callArg.items[1].quantity).toBe(20);
    expect(callArg.status).toBe('pending_review');
    // Prices should NOT be set by bot
    expect(callArg.items[0].unitPrice).toBeUndefined();
    expect(callArg.items[0].totalPrice).toBeUndefined();
  });

  test('createQuoteRequest assigns line numbers', async () => {
    Quote.create.mockImplementation(async (data) => data);
    const data = {
      whatsappNumber: '919876543210',
      items: [
        { categoryLabel: 'A', quantity: 1 },
        { categoryLabel: 'B', quantity: 2 },
        { categoryLabel: 'C', quantity: 3 },
      ],
      quoteData: {},
    };
    const result = await quotesService.createQuoteRequest(data);
    expect(result.items[0].lineNumber).toBe(1);
    expect(result.items[1].lineNumber).toBe(2);
    expect(result.items[2].lineNumber).toBe(3);
  });

  test('quote starts in pending_review status', async () => {
    Quote.create.mockImplementation(async (data) => data);
    const result = await quotesService.createQuoteRequest({
      whatsappNumber: '1', items: [], quoteData: {},
    });
    expect(result.status).toBe('pending_review');
  });
});

// ─── Tickets ───────────────────────────────────────────────────────────────────

describe('ticketsService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createTicket sets status to open', async () => {
    Ticket.create.mockImplementation(async (data) => data);
    const result = await ticketsService.createTicket({
      whatsappNumber: '919876543210',
      category: 'damaged_item',
      orderRef: 'ORD-001',
      summary: 'Chair damaged',
    });
    expect(result.status).toBe('open');
  });

  test('createTicket adds initial timeline entry', async () => {
    Ticket.create.mockImplementation(async (data) => data);
    const result = await ticketsService.createTicket({
      whatsappNumber: '919876543210',
      category: 'warranty',
      summary: 'Test',
    });
    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].actor).toBe('bot');
    expect(result.timeline[0].action).toBe('created');
  });

  test('createTicket generates unique ticketId', async () => {
    Ticket.create.mockImplementation(async (data) => data);
    const t1 = await ticketsService.createTicket({ whatsappNumber: '1', category: 'other', summary: 'a' });
    const t2 = await ticketsService.createTicket({ whatsappNumber: '2', category: 'other', summary: 'b' });
    expect(t1.ticketId).not.toBe(t2.ticketId);
  });
});
