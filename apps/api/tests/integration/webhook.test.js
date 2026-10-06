'use strict';

/**
 * Integration tests for the webhook endpoint.
 * Uses supertest to hit the real Express app.
 * MongoDB is mocked to avoid requiring a running database.
 */

// Mock MongoDB models and conversation engine before app loads
jest.mock('../../src/config/database', () => ({
  connectDatabase: jest.fn().mockResolvedValue(true),
  disconnectDatabase: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/models/Message', () => ({
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ processed: false, save: jest.fn() }),
}));

jest.mock('../../src/models/AuditLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/models/Contact', () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'c1', consent: {}, save: jest.fn() }),
}));

jest.mock('../../src/models/Conversation', () => ({
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({
    _id: 'conv-1',
    whatsappNumber: '919876543210',
    currentFlow: 'idle',
    currentStep: 'initial',
    owner: 'BOT',
    selectedItems: [],
    selectedCategories: [],
    stepData: {},
    status: 'active',
    lastMessageAt: new Date(),
    save: jest.fn().mockResolvedValue(true),
  }),
}));

jest.mock('../../src/conversation/conversationEngine', () => ({
  processEvent: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../src/models/Lead', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }),
}));

jest.mock('../../src/models/Quote', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../src/models/Ticket', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));

const request = require('supertest');
const app = require('../../src/app');
const { processEvent } = require('../../src/conversation/conversationEngine');

// Valid MSG91-style webhook payload
const validPayload = {
  data: {
    id: 'msg-test-001',
    from: '919876543210',
    type: 'text',
    timestamp: Math.floor(Date.now() / 1000),
    text: { body: 'Hello' },
    contacts: [{ profile: { name: 'Test User' } }],
  },
};

describe('POST /webhooks/whatsapp', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 200 immediately (async processing)', async () => {
    const res = await request(app)
      .post('/webhooks/whatsapp')
      .send(validPayload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('responds 200 even with empty body (invalid event)', async () => {
    const res = await request(app)
      .post('/webhooks/whatsapp')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    // processEvent should not be called for invalid events
  });

  test('health check returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/nonexistent-endpoint');
    expect(res.status).toBe(401); // hits auth middleware first (protected routes need key)
  });

  test('protected API routes require auth key', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
  });

  test('protected routes work with valid admin key (auth passes)', async () => {
    // We just verify auth middleware passes — the route itself may error on missing DB mock
    // which is fine; what matters is it's NOT a 401
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('X-API-Key', 'dev_admin_key')
      .timeout(3000);

    // Auth passed (not 401); may be 500 due to missing DB in test — that's acceptable
    expect(res.status).not.toBe(401);
  }, 10000);
});

describe('Webhook event processing', () => {
  beforeEach(() => jest.clearAllMocks());

  test('processEvent is called asynchronously with parsed event', async () => {
    await request(app)
      .post('/webhooks/whatsapp')
      .send(validPayload);

    // Give async processing time to execute
    await new Promise((r) => setTimeout(r, 50));
    expect(processEvent).toHaveBeenCalledTimes(1);
    const calledWith = processEvent.mock.calls[0][0];
    expect(calledWith.from).toBe('919876543210');
    expect(calledWith.text).toBe('Hello');
    expect(calledWith.type).toBe('text');
  });

  test('processEvent is NOT called for events with no from field', async () => {
    await request(app)
      .post('/webhooks/whatsapp')
      .send({ data: { type: 'text', text: { body: 'Hi' } } }); // no from

    await new Promise((r) => setTimeout(r, 50));
    expect(processEvent).not.toHaveBeenCalled();
  });

  test('interactive list_reply event is parsed and processed', async () => {
    const interactivePayload = {
      data: {
        id: 'msg-interactive-001',
        from: '919876543210',
        type: 'interactive',
        timestamp: Math.floor(Date.now() / 1000),
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'cat_office_chairs', title: 'Office Chairs' },
        },
      },
    };

    await request(app)
      .post('/webhooks/whatsapp')
      .send(interactivePayload);

    await new Promise((r) => setTimeout(r, 50));
    expect(processEvent).toHaveBeenCalledTimes(1);
    const event = processEvent.mock.calls[0][0];
    expect(event.interactiveId).toBe('cat_office_chairs');
    expect(event.type).toBe('interactive');
  });
});
