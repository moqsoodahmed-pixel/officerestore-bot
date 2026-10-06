'use strict';

const { sendText, sendButtons } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const catalogueService = require('../../services/catalogue/catalogueService');

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;
  const { from } = event;

  if (step === 'initial') {
    await sendText(from,
      '🔍 *Availability & Pricing*\n\n' +
      'Please share the product name, SKU or product page URL you\'d like to check.\n\n' +
      'Example: "Office Chair Model OC-100" or "https://officerestore.com/products/chair"\n\n' +
      '_Prices and availability are sourced live from our catalogue._'
    );
    await stateManager.transition(conversation, 'pricing', 'awaiting_product');
    return;
  }

  if (step === 'awaiting_product') {
    const query = (event.text || '').trim();
    if (!query || query.length < 3) {
      await sendText(from, 'Please share a product name, SKU or URL to check.');
      return;
    }

    // Try catalogue lookup — never invent prices
    const product = query.startsWith('http')
      ? await catalogueService.getProductByUrl(query)
      : await catalogueService.searchProducts(query);

    if (!product || (Array.isArray(product) && product.length === 0)) {
      await sendButtons(from, {
        body:
          'Our team will confirm the latest price and availability for:\n' +
          `"${query}"\n\n` +
          '_We are unable to verify live pricing at this moment. Our sales team will provide accurate information._',
        buttons: [
          { id: 'pricing_quote', title: 'Request a Quote' },
          { id: 'pricing_human', title: 'Talk to Sales' },
        ],
      });
      await stateManager.transition(conversation, 'pricing', 'awaiting_action');
      return;
    }

    // If product found, show verified data
    const p = Array.isArray(product) ? product[0] : product;
    const priceText = p.price ? `₹${p.price}` : 'Please contact team for current pricing';
    const stockText = p.inStock ? 'In stock' : 'Please check with team for availability';

    await sendButtons(from, {
      body:
        `📦 *${p.name || query}*\n\n` +
        `Listed price: ${priceText}\n` +
        `Availability: ${stockText}\n` +
        (p.url ? `Product page: ${p.url}\n` : '') +
        '\n_Prices are subject to change. Bulk pricing requires a formal quote._',
      buttons: [
        { id: 'pricing_quote', title: 'Request a Quote' },
        { id: 'pricing_human', title: 'Talk to Sales' },
      ],
    });
    await stateManager.transition(conversation, 'pricing', 'awaiting_action');
    return;
  }

  if (step === 'awaiting_action') {
    const id = event.interactiveId || '';
    if (id === 'pricing_quote') {
      await stateManager.transition(conversation, 'quote', 'initial');
      const quoteFlow = require('./quoteFlow');
      return quoteFlow.handle(event, conversation, contact);
    }
    if (id === 'pricing_human') {
      await stateManager.transition(conversation, 'human_handoff', 'initial');
      const supportFlow = require('./supportFlow');
      return supportFlow.handle(event, conversation, contact);
    }
  }
}

module.exports = { handle };
