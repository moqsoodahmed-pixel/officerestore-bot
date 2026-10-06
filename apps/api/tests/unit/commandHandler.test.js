'use strict';

const { detectCommand } = require('../../src/conversation/commandHandler');

describe('detectCommand', () => {
  test.each([
    ['MENU', 'MENU'],
    ['menu', 'MENU'],
    ['Menu', 'MENU'],
    ['BACK', 'BACK'],
    ['back', 'BACK'],
    ['SUPPORT', 'SUPPORT'],
    ['support', 'SUPPORT'],
    ['HUMAN', 'HUMAN'],
    ['human', 'HUMAN'],
    ['STOP', 'STOP'],
    ['stop', 'STOP'],
    ['hi', 'HI'],
    ['Hello', 'HI'],
    ['hey', 'HI'],
  ])('detects "%s" as %s', (input, expected) => {
    expect(detectCommand(input)).toBe(expected);
  });

  test.each([
    ['Office Chair'],
    ['I need 50 chairs'],
    ['560001'],
    ['random text'],
    [''],
  ])('returns null for non-command "%s"', (input) => {
    expect(detectCommand(input)).toBeNull();
  });

  test('returns null for null/undefined input', () => {
    expect(detectCommand(null)).toBeNull();
    expect(detectCommand(undefined)).toBeNull();
  });
});
