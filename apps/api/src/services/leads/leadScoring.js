'use strict';

/**
 * Lead scoring rules from the Officerestore spec (section 5).
 *
 * HOT : bulk requirement, quotation requested, 20+ quantity,
 *       budget provided, or purchase within 30 days
 * WARM: product enquiry, price enquiry, 5–20 quantity,
 *       or active product discussion
 * COLD: general browsing / no clear buying requirement
 */

const SOON_TIMELINES = ['immediately', 'within 30 days'];

function hasBudget(budget) {
  if (!budget) return false;
  const b = String(budget).trim().toLowerCase();
  return b !== '' && b !== 'skip' && b !== 'not specified';
}

function scoreLead(lead = {}) {
  const qty = Number(lead.quantity || lead.seats || 0);
  const timeline = String(lead.timeline || '').toLowerCase();

  if (
    lead.leadType === 'bulk_office' ||
    lead.quoteRequested ||
    qty >= 20 ||
    hasBudget(lead.budget) ||
    SOON_TIMELINES.includes(timeline)
  ) {
    return 'HOT';
  }

  if (
    lead.leadType === 'product_enquiry' ||
    lead.leadType === 'office_setup' ||
    lead.leadType === 'quote_request' ||
    (qty >= 5 && qty < 20) ||
    (lead.items && lead.items.length > 0) ||
    lead.handoverRequested
  ) {
    return 'WARM';
  }

  return 'COLD';
}

module.exports = { scoreLead };