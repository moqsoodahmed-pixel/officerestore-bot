'use strict';

const welcomeFlow = require('./flows/welcomeFlow');
const productFlow = require('./flows/productFlow');
const bulkEnquiryFlow = require('./flows/bulkEnquiryFlow');
const quoteFlow = require('./flows/quoteFlow');
const pricingFlow = require('./flows/pricingFlow');
const deliveryFlow = require('./flows/deliveryFlow');
const orderFlow = require('./flows/orderFlow');
const invoiceFlow = require('./flows/invoiceFlow');
const complaintFlow = require('./flows/complaintFlow');
const supportFlow = require('./flows/supportFlow');
const logger = require('../utils/logger');

const FLOW_MAP = {
  idle: welcomeFlow,
  welcome: welcomeFlow,
  browse_products: productFlow,
  bulk_enquiry: bulkEnquiryFlow,
  quote: quoteFlow,
  pricing: pricingFlow,
  delivery: deliveryFlow,
  order_tracking: orderFlow,
  invoice: invoiceFlow,
  complaint: complaintFlow,
  support: supportFlow,
  human_handoff: supportFlow,
};

/**
 * Route an inbound event to the correct flow handler.
 * Returns the next step instructions.
 */
async function route(event, conversation, contact) {
  const flow = conversation.currentFlow || 'idle';
  const handler = FLOW_MAP[flow] || welcomeFlow;

  logger.info('Routing to flow', {
    whatsappNumber: event.from,
    flow,
    step: conversation.currentStep,
  });

  return handler.handle(event, conversation, contact);
}

module.exports = { route };
