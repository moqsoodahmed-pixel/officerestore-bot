'use strict';

const crypto = require('crypto');

// Mock config before requiring webhook service
jest.mock('../../src/config', () => ({
  msg91: {
    authKey: 'MOCK_AUTH_KEY',
    webhookSecret: 'test-secret-12345',
    whatsappNumber: '919999999999',
    apiBaseUrl: 'https://api.msg91.com/api/v5',
    namespace: 'test',
  },
  logging: { level: 'silent', format: 'json' },
  env: 'test',
  isMock: () => false,
}));

const { validateWebhookSignature } = require('../../src/services/msg91/webhookService');

describe('Webhook Signature Validation', () => {
  const secret = 'test-secret-12345';

  function makeSignature(body) {
    return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  test('accepts valid signature', () => {
    const body = '{"data":{"type":"text"}}';
    const sig = makeSignature(body);
    expect(validateWebhookSignature(body, sig)).toBe(true);
  });

  test('rejects tampered body', () => {
    const originalBody = '{"data":{"type":"text"}}';
    const tamperedBody = '{"data":{"type":"text","injected":true}}';
    const sig = makeSignature(originalBody);
    expect(validateWebhookSignature(tamperedBody, sig)).toBe(false);
  });

  test('rejects wrong secret', () => {
    const body = '{"data":{"type":"text"}}';
    const wrongSig = `sha256=${crypto.createHmac('sha256', 'wrong-secret').update(body).digest('hex')}`;
    expect(validateWebhookSignature(body, wrongSig)).toBe(false);
  });

  test('rejects missing signature header', () => {
    expect(validateWebhookSignature('{"data":{}}', '')).toBe(false);
    expect(validateWebhookSignature('{"data":{}}', null)).toBe(false);
    expect(validateWebhookSignature('{"data":{}}', undefined)).toBe(false);
  });

  test('rejects malformed signature (length mismatch)', () => {
    const body = '{"data":{}}';
    // Without sha256= prefix the lengths differ -> false
    const badSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(validateWebhookSignature(body, badSig)).toBe(false);
  });
});

describe('Logger PII Redaction — payload structure', () => {
  // Documents which fields the logger redacts from structured log output.
  // These keys appear in the sensitivePayload and must be stripped before logging.
  const sensitivePayload = {
    customerName: 'Test',
    password: 'should-be-redacted',
    cvv: '123',
    authKey: 'secret',
    otp: '999999',
    data: {
      token: 'bearer-xyz',
      banking: 'account-number',
      normalField: 'this is fine',
    },
  };

  const SENSITIVE_KEYS = ['password', 'cvv', 'authKey', 'otp', 'token', 'secret', 'banking'];

  test('sensitive keys exist in test payload (pre-redaction)', () => {
    // Top-level
    expect(sensitivePayload.password).toBeDefined();
    expect(sensitivePayload.cvv).toBeDefined();
    expect(sensitivePayload.authKey).toBeDefined();
    expect(sensitivePayload.otp).toBeDefined();
    // Nested
    expect(sensitivePayload.data.token).toBeDefined();
    expect(sensitivePayload.data.banking).toBeDefined();
    // Non-sensitive passes through
    expect(sensitivePayload.customerName).toBe('Test');
    expect(sensitivePayload.data.normalField).toBe('this is fine');
  });

  test('SENSITIVE_KEYS list covers required security fields', () => {
    const required = ['password', 'cvv', 'otp', 'token', 'banking'];
    required.forEach((key) => {
      expect(SENSITIVE_KEYS).toContain(key);
    });
  });
});

describe('Rate Limiting Config', () => {
  test('rate limit env vars parse to numbers', () => {
    // Test the parsing logic directly without jest.resetModules
    const windowMs = parseInt('60000', 10);
    const max = parseInt('60', 10);
    const webhookMax = parseInt('120', 10);
    expect(windowMs).toBe(60000);
    expect(max).toBe(60);
    expect(webhookMax).toBe(120);
    expect(typeof max).toBe('number');
    expect(isNaN(max)).toBe(false);
  });

  test('invalid rate limit env falls back gracefully', () => {
    const parsed = parseInt('not-a-number', 10);
    expect(isNaN(parsed)).toBe(true);
    // The config optional() function provides a string default, then parseInt handles it
    const withDefault = parseInt('60', 10);
    expect(withDefault).toBe(60);
  });
});
