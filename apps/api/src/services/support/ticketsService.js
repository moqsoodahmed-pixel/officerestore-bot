'use strict';

const Ticket = require('../../models/Ticket');
const AuditLog = require('../../models/AuditLog');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

function generateTicketId() {
  return `TKT-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
}

async function createTicket(data) {
  const ticketId = generateTicketId();

  const ticket = await Ticket.create({
    ticketId,
    whatsappNumber: data.whatsappNumber,
    contactId: data.contactId,
    category: data.category || 'other',
    priority: data.priority || 'medium',
    orderRef: data.orderRef,
    productName: data.productName,
    sku: data.sku,
    summary: data.summary,
    description: data.description,
    status: 'open',
    timeline: [{
      at: new Date(),
      actor: 'bot',
      action: 'created',
      note: 'Ticket created via WhatsApp bot',
    }],
  });

  await AuditLog.create({
    whatsappNumber: data.whatsappNumber,
    contactId: data.contactId,
    eventType: 'ticket_created',
    meta: { ticketId, category: data.category },
    ticketId,
  });

  logger.info('Ticket created', { ticketId, category: data.category });
  return ticket;
}

async function updateTicket(ticketId, updates, actor = 'system') {
  const ticket = await Ticket.findOneAndUpdate(
    { ticketId },
    {
      $set: updates,
      $push: {
        timeline: {
          at: new Date(),
          actor,
          action: 'updated',
          note: JSON.stringify(Object.keys(updates)),
        },
      },
    },
    { new: true }
  );

  if (ticket) {
    await AuditLog.create({
      whatsappNumber: ticket.whatsappNumber,
      eventType: 'ticket_updated',
      meta: { ticketId, updates: Object.keys(updates) },
      ticketId,
    });
  }
  return ticket;
}

async function getTickets(filters = {}, page = 1, limit = 20) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;

  const [tickets, total] = await Promise.all([
    Ticket.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Ticket.countDocuments(query),
  ]);

  return { tickets, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getTicket(ticketId) {
  return Ticket.findOne({ ticketId }).lean();
}

module.exports = { createTicket, updateTicket, getTickets, getTicket };
