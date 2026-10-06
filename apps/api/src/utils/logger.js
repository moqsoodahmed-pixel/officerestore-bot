'use strict';

const { createLogger, format, transports } = require('winston');
const config = require('../config');

// Redact sensitive fields from log objects
const SENSITIVE_KEYS = [
  'password', 'otp', 'cvv', 'token', 'secret', 'authKey',
  'auth_key', 'card', 'pin', 'credential', 'banking',
];

function redact(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lk.includes(s))) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = redact(v, seen);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const redactFormat = format((info) => {
  if (info.meta) info.meta = redact(info.meta);
  if (info.data) info.data = redact(info.data);
  return info;
});

const logger = createLogger({
  level: config.logging.level,
  format: format.combine(
    redactFormat(),
    format.timestamp(),
    config.logging.format === 'json'
      ? format.json()
      : format.combine(format.colorize(), format.simple())
  ),
  transports: [new transports.Console()],
  exitOnError: false,
});

module.exports = logger;
