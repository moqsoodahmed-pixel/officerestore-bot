'use strict';

const config = require('../../config');
const logger = require('../../utils/logger');
const AuditLog = require('../../models/AuditLog');

/**
 * Sends the "NEW WHATSAPP LEAD" alert (spec section 8) to every number in
 * SALES_ALERT_NUMBERS.
 *
 * WhatsApp rule: a free-text message only reaches a number that has messaged
 * the business number in the last 24 hours. Salespeople should message the
 * bot number once a day (or we switch this to an approved template later).
 * Failures are logged and never break the customer conversation.
 */
function buildAlert(lead, reason) {
  const lines = [
    '🔔 *NEW WHATSAPP LEAD*',
    '',
    `Customer: ${lead.customerName || 'Not provided'}`,
    `WhatsApp: +${lead.whatsappNumber}`,
  ];
  if (lead.contactPhone && lead.contactPhone !== lead.whatsappNumber) lines.push(`Phone: ${lead.contactPhone}`);
  if (lead.companyName) lines.push(`Company: ${lead.companyName}`);
  if (lead.requirement) lines.push(`Requirement: ${lead.requirement}`);
  if (lead.category && !lead.requirement) lines.push(`Category: ${lead.category}`);
  if (lead.quantity) lines.push(`Quantity: ${lead.quantity}`);
  if (lead.seats) lines.push(`Seats: ${lead.seats}`);
  if (lead.teamSize) lines.push(`Team size: ${lead.teamSize}`);
  if (lead.budget) lines.push(`Budget: ${lead.budget}`);
  if (lead.location) lines.push(`Location: ${lead.location}`);
  if (lead.timeline) lines.push(`Timeline: ${lead.timeline}`);
  lines.push(`Lead Score: ${lead.leadScore || 'COLD'}${lead.priority === 'HIGH' ? ' (HIGH PRIORITY)' : ''}`);
  if (lead.quoteRequested) lines.push('Quote requested: Yes');
  lines.push(`Lead ID: ${lead.leadId}`);
  lines.push('Source: WhatsApp');
  if (reason) lines.push('', `Reason: ${reason}`);
  return lines.join('\n');
}

async function notifySales(lead, reason) {
  const numbers = config.sales.alertNumbers;
  if (!lead) return;

  if (!numbers.length) {
    logger.warn('Sales alert skipped — SALES_ALERT_NUMBERS not set', { leadId: lead.leadId });
    return;
  }

  // Lazy require avoids loading the WhatsApp service during model setup
  const { sendText } = require('../msg91/whatsappService');
  const text = buildAlert(lead, reason);

  for (const number of numbers) {
    try {
      await sendText(number, text);
      logger.info('Sales alert sent', { leadId: lead.leadId, to: number });
    } catch (err) {
      logger.error('Sales alert failed', { leadId: lead.leadId, to: number, error: err.message });
    }
  }

  try {
    const Lead = require('../../models/Lead');
    await Lead.updateOne({ leadId: lead.leadId }, { $set: { salesNotifiedAt: new Date() } });
    await AuditLog.create({
      whatsappNumber: lead.whatsappNumber,
      eventType: 'sales_alert',
      meta: { leadId: lead.leadId, reason, to: numbers },
      leadId: lead.leadId,
    });
  } catch (err) {
    logger.warn('Could not record sales alert', { error: err.message });
  }
}

module.exports = { notifySales, buildAlert };