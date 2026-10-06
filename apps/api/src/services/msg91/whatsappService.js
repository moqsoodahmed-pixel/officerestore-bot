'use strict';

const { sendWhatsApp } = require('./msg91Client');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * WhatsApp message builders for MSG91.
 *
 * MSG91 supports:
 *  - Text messages
 *  - Interactive list messages (up to 10 rows, grouped in sections)
 *  - Interactive button messages (up to 3 buttons)
 *  - Template messages (pre-approved by Meta)
 */

const FROM = config.msg91.whatsappNumber;

// ─── Text Message ────────────────────────────────────────────────────────────

async function sendText(to, text) {
  const payload = {
    from: FROM,
    to: normalizeNumber(to),
    type: 'text',
    text: { body: text },
  };
  return _send(payload, 'text');
}

// ─── Interactive List Message ─────────────────────────────────────────────────
// Best for category/product selection. Shows a list button that opens a sheet.
// Max 10 rows total across all sections. Row IDs must be ≤24 chars.

/**
 * @param {string} to
 * @param {object} opts
 * @param {string} opts.header - Optional header text
 * @param {string} opts.body - Main body text (required)
 * @param {string} opts.footer - Optional footer text
 * @param {string} opts.buttonLabel - Label for the list-open button (≤20 chars)
 * @param {Array}  opts.sections - Array of { title, rows: [{ id, title, description? }] }
 */
async function sendList(to, { header, body, footer, buttonLabel = 'Choose Option', sections }) {
  // Truncate section rows to 10 total (WhatsApp hard limit)
  const truncatedSections = limitRows(sections, 10);

  const payload = {
    from: FROM,
    to: normalizeNumber(to),
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(header && { header: { type: 'text', text: header } }),
      body: { text: body },
      ...(footer && { footer: { text: footer } }),
      action: {
        button: buttonLabel,
        sections: truncatedSections,
      },
    },
  };
  return _send(payload, 'list');
}

// ─── Interactive Button Message ───────────────────────────────────────────────
// Max 3 buttons. Good for binary/ternary choices.

/**
 * @param {string} to
 * @param {object} opts
 * @param {string} opts.header - Optional header
 * @param {string} opts.body - Body text (required)
 * @param {string} opts.footer - Optional footer
 * @param {Array}  opts.buttons - Array of { id, title } (max 3)
 */
async function sendButtons(to, { header, body, footer, buttons }) {
  const cappedButtons = buttons.slice(0, 3).map((b) => ({
    type: 'reply',
    reply: { id: b.id.substring(0, 256), title: b.title.substring(0, 20) },
  }));

  const payload = {
    from: FROM,
    to: normalizeNumber(to),
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(header && { header: { type: 'text', text: header } }),
      body: { text: body },
      ...(footer && { footer: { text: footer } }),
      action: { buttons: cappedButtons },
    },
  };
  return _send(payload, 'buttons');
}

// ─── Template Message ─────────────────────────────────────────────────────────

/**
 * @param {string} to
 * @param {string} templateName - Approved template name
 * @param {string} languageCode - e.g. 'en'
 * @param {Array}  components - Template component parameters
 */
async function sendTemplate(to, templateName, languageCode = 'en', components = []) {
  const payload = {
    from: FROM,
    to: normalizeNumber(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };
  return _send(payload, 'template');
}

// ─── Composite Helpers ────────────────────────────────────────────────────────

/**
 * Send a "Done / Add Another" choice after a selection.
 */
async function sendAddAnotherOrDone(to, selectedLabel, allSelected) {
  const selectedList = allSelected.map((s) => `✓ ${s}`).join('\n');
  const body =
    `*${selectedLabel}* added.\n\n` +
    `Your selection so far:\n${selectedList}\n\n` +
    `Would you like to add another item?`;

  return sendButtons(to, {
    body,
    buttons: [
      { id: 'add_another', title: 'Add Another' },
      { id: 'done_selection', title: 'Done ✓' },
    ],
  });
}

/**
 * Send the main menu as an interactive list (spec section 2).
 */
async function sendMainMenu(to, greeting = '') {
  const body =
    (greeting ? `${greeting}\n\n` : '') +
    'How can we help you today?';

  return sendList(to, {
    header: '🪑 Officerestore',
    body,
    footer: 'Reply MENU anytime to return here.',
    buttonLabel: 'Choose Option',
    sections: [
      {
        title: 'How can we help?',
        rows: [
          { id: 'menu_buy', title: 'Buy Office Furniture', description: 'Chairs, workstations, tables & more' },
          { id: 'menu_setup', title: 'Setup My Office', description: 'Complete furniture for your team' },
          { id: 'menu_bulk', title: 'Bulk / Corporate', description: 'Large or corporate requirements' },
          { id: 'menu_find', title: 'Find a Product', description: 'Tell us what you need' },
          { id: 'menu_visit', title: 'Visit Our Store', description: 'Address, timings & directions' },
          { id: 'menu_sales', title: 'Talk to Sales', description: 'Chat with our sales team' },
        ],
      },
    ],
  });
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _send(payload, type) {
  try {
    const result = await sendWhatsApp(payload);
    logger.info('WhatsApp message sent', { to: payload.to, type, messageId: result?.messageId });
    return result;
  } catch (err) {
    logger.error('WhatsApp send failed', { to: payload.to, type, error: err.message });
    throw err;
  }
}

function normalizeNumber(number) {
  // Ensure no leading +, just digits
  return String(number).replace(/\D/g, '');
}

function limitRows(sections, max) {
  let total = 0;
  return sections.map((section) => {
    const rows = [];
    for (const row of section.rows) {
      if (total >= max) break;
      rows.push({
        id: row.id.substring(0, 24),
        title: row.title.substring(0, 24),
        ...(row.description && { description: row.description.substring(0, 72) }),
      });
      total++;
    }
    return { ...section, rows };
  }).filter((s) => s.rows.length > 0);
}

module.exports = {
  sendText,
  sendList,
  sendButtons,
  sendTemplate,
  sendAddAnotherOrDone,
  sendMainMenu,
};