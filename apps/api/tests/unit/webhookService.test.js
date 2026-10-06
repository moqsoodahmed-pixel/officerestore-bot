'use strict';

const { parseWebhookEvent } = require('../../src/services/msg91/webhookService');

describe('webhookService.parseWebhookEvent', () => {
  const baseEvent = {
    data: {
      id: 'msg-001',
      from: '919876543210',
      type: 'text',
      timestamp: 1700000000,
      text: { body: 'Hello' },
      contacts: [{ profile: { name: 'Test User' } }],
    },
  };

  test('parses a text message', () => {
    const event = parseWebhookEvent(baseEvent);
    expect(event).not.toBeNull();
    expect(event.from).toBe('919876543210');
    expect(event.type).toBe('text');
    expect(event.text).toBe('Hello');
    expect(event.senderName).toBe('Test User');
    expect(event.messageId).toBe('msg-001');
  });

  test('parses an interactive list_reply', () => {
    const event = parseWebhookEvent({
      data: {
        ...baseEvent.data,
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'cat_office_chairs', title: 'Office Chairs' },
        },
      },
    });
    expect(event.interactiveId).toBe('cat_office_chairs');
    expect(event.interactiveTitle).toBe('Office Chairs');
    expect(event.interactiveType).toBe('list_reply');
  });

  test('parses an interactive button_reply', () => {
    const event = parseWebhookEvent({
      data: {
        ...baseEvent.data,
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'done_selection', title: 'Done ✓' },
        },
      },
    });
    expect(event.interactiveId).toBe('done_selection');
    expect(event.interactiveTitle).toBe('Done ✓');
  });

  test('returns null for missing from field', () => {
    const event = parseWebhookEvent({ data: { type: 'text' } });
    expect(event).toBeNull();
  });

  test('returns null for empty body', () => {
    expect(parseWebhookEvent(null)).toBeNull();
    expect(parseWebhookEvent({})).toBeNull();
  });

  test('normalizes phone number (strips non-digits)', () => {
    const event = parseWebhookEvent({
      data: { ...baseEvent.data, from: '+91-98765-43210' },
    });
    expect(event.from).toBe('919876543210');
  });
});
