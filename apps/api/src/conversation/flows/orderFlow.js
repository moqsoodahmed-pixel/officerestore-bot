'use strict';

const { sendText, sendButtons } = require('../../services/msg91/whatsappService');
const stateManager = require('../stateManager');
const orderService = require('../../services/orders/orderService');
const AuditLog = require('../../models/AuditLog');

/**
 * Order Tracking Flow.
 * SECURITY: Never expose order details without verification.
 * SECURITY: Never disclose whether an order exists if auth fails.
 */

async function handle(event, conversation, contact) {
  const step = conversation.currentStep;
  const { from } = event;

  if (step === 'initial') {
    await sendButtons(from, {
      header: '📦 Order Tracking',
      body: 'Please select what you need:',
      buttons: [
        { id: 'order_track', title: 'Track My Order' },
        { id: 'order_help', title: 'Order Help' },
      ],
    });
    await stateManager.transition(conversation, 'order_tracking', 'awaiting_choice');
    return;
  }

  if (step === 'awaiting_choice') {
    const id = event.interactiveId || '';
    if (id === 'order_help') {
      // Route to support
      await stateManager.transition(conversation, 'support', 'initial');
      return require('./supportFlow').handle(event, conversation, contact);
    }
    // order_track — ask for order ref
    await sendText(from,
      'Please enter your *order reference number* or *order ID*.\n\n' +
      '_For your privacy, we verify your identity before sharing order details._'
    );
    await stateManager.transition(conversation, 'order_tracking', 'awaiting_order_ref');
    return;
  }

  if (step === 'awaiting_order_ref') {
    const orderRef = (event.text || '').trim();
    if (!orderRef || orderRef.length < 3) {
      await sendText(from, 'Please provide a valid order reference number.');
      return;
    }

    conversation.orderTracking = { orderRef };
    await stateManager.saveConversation(conversation);

    // Attempt authenticated lookup: verify whatsappNumber matches order
    const order = await orderService.lookupOrder(orderRef, from);

    await AuditLog.create({
      whatsappNumber: from,
      contactId: conversation.contactId,
      eventType: order ? 'order_lookup' : 'order_lookup_failed',
      meta: { orderRef },
    });

    if (!order) {
      // SECURITY: Do not reveal whether order exists or not
      await sendButtons(from, {
        body:
          'We were unable to retrieve order information for the reference provided.\n\n' +
          '_Please ensure the order number is correct and was placed using this phone number._',
        buttons: [
          { id: 'order_retry', title: 'Try Again' },
          { id: 'order_support', title: 'Contact Support' },
        ],
      });
      await stateManager.transition(conversation, 'order_tracking', 'awaiting_retry');
      return;
    }

    // Show minimum necessary information only
    const trackingLine = order.trackingUrl ? `\nTracking: ${order.trackingUrl}` : '';
    await sendButtons(from, {
      body:
        `📦 *Order ${orderRef}*\n\n` +
        `Status: ${order.status || 'Processing'}\n` +
        trackingLine +
        `\nNext step: ${order.nextStep || 'Our team will update you shortly.'}\n\n` +
        `_For detailed support, contact our team._`,
      buttons: [
        { id: 'order_support', title: 'Order Support' },
        { id: 'menu_main', title: 'Main Menu' },
      ],
    });
    await stateManager.transition(conversation, 'order_tracking', 'completed');
    return;
  }

  if (step === 'awaiting_retry') {
    const id = event.interactiveId || '';
    if (id === 'order_retry') {
      await stateManager.transition(conversation, 'order_tracking', 'awaiting_order_ref');
      await sendText(from, 'Please enter your order reference number:');
      return;
    }
    await stateManager.transition(conversation, 'support', 'initial');
    return require('./supportFlow').handle(event, conversation, contact);
  }
}

module.exports = { handle };
