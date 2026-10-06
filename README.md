# Officerestore WhatsApp Bot

A production-ready WhatsApp commerce assistant for Officerestore.com, built with:

- **Node.js + Express.js** — API server
- **MongoDB + Mongoose** — Persistent conversation state and business records
- **MSG91 WhatsApp API** — WhatsApp Business Platform integration
- **React + Vite** — Admin dashboard
- **JavaScript only** — No TypeScript

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Environment Variables](#environment-variables)
4. [MSG91 Setup](#msg91-setup)
5. [Catalogue Integration](#catalogue-integration)
6. [Conversation Flows](#conversation-flows)
7. [Multi-Selection Flow](#multi-selection-flow)
8. [Human Takeover](#human-takeover)
9. [Global Commands](#global-commands)
10. [API Reference](#api-reference)
11. [Webhook Payloads](#webhook-payloads)
12. [Admin Dashboard](#admin-dashboard)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Security Notes](#security-notes)
16. [Integration Points](#integration-points)

---

## Architecture Overview

```
officerestore-whatsapp-bot/
├── apps/
│   ├── api/                          # Node.js/Express backend
│   │   └── src/
│   │       ├── config/               # Env config & database connection
│   │       ├── models/               # Mongoose models
│   │       │   ├── Contact.js
│   │       │   ├── Conversation.js   # Persistent state machine
│   │       │   ├── Message.js        # Deduplication index
│   │       │   ├── Lead.js
│   │       │   ├── Quote.js
│   │       │   ├── Ticket.js
│   │       │   └── AuditLog.js
│   │       ├── services/
│   │       │   ├── msg91/            # MSG91 API client & webhook parser
│   │       │   ├── catalogue/        # Catalogue abstraction (mock/woo/shopify/custom)
│   │       │   ├── orders/           # Order lookup abstraction
│   │       │   ├── leads/
│   │       │   ├── quotes/
│   │       │   └── support/
│   │       ├── conversation/         # State machine engine
│   │       │   ├── conversationEngine.js
│   │       │   ├── stateManager.js
│   │       │   ├── flowRouter.js
│   │       │   ├── commandHandler.js
│   │       │   └── flows/
│   │       │       ├── welcomeFlow.js
│   │       │       ├── productFlow.js      # Multi-selection
│   │       │       ├── bulkEnquiryFlow.js
│   │       │       ├── quoteFlow.js
│   │       │       ├── pricingFlow.js
│   │       │       ├── deliveryFlow.js
│   │       │       ├── orderFlow.js
│   │       │       ├── invoiceFlow.js
│   │       │       ├── complaintFlow.js
│   │       │       └── supportFlow.js
│   │       ├── controllers/
│   │       ├── routes/
│   │       ├── middleware/
│   │       └── utils/logger.js
│   └── web/                          # React admin dashboard
│       └── src/
│           ├── pages/               # Dashboard, Leads, Quotes, Tickets, Conversations
│           ├── components/          # Layout, Table, Card, StatusBadge, etc.
│           └── services/api.js
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB 7.0+ (local or Atlas)
- MSG91 account (or use mock mode for development)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd officerestore-whatsapp-bot
cp .env.example .env
# Edit .env with your values

cd apps/api && npm install
cd ../web && npm install
```

### 2. Start MongoDB

```bash
# Local MongoDB
mongod --dbpath /data/db

# Or with Docker
docker run -d -p 27017:27017 --name mongo mongo:7.0
```

### 3. Start the API (development)

```bash
cd apps/api
npm run dev
```

Server starts at `http://localhost:3000`.

### 4. Start the admin dashboard

```bash
cd apps/web
npm run dev
```

Dashboard at `http://localhost:5173`.

### 5. Expose webhook for MSG91 (development)

Use [ngrok](https://ngrok.com) or [localtunnel](https://localtunnel.me):

```bash
ngrok http 3000
# Copy the https URL — e.g. https://abc123.ngrok.io
```

Set your MSG91 webhook URL to: `https://abc123.ngrok.io/webhooks/whatsapp`

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MSG91_AUTH_KEY` | Yes (production) | MSG91 API authentication key |
| `MSG91_WHATSAPP_NUMBER` | Yes (production) | Your MSG91 WhatsApp number (E.164 without +) |
| `MSG91_WEBHOOK_SECRET` | Yes (production) | HMAC secret for webhook signature validation |
| `CATALOGUE_PROVIDER` | No | `mock` (default) \| `woocommerce` \| `shopify` \| `custom` |
| `ADMIN_API_KEY` | Yes | API key for admin dashboard and REST API |
| `JWT_SECRET` | Yes | Long random string (≥32 chars) |
| `CONVERSATION_TIMEOUT_SECONDS` | No | Idle timeout before state reset (default: 1800) |

In **mock mode** (default), the bot runs with no external dependencies. All catalogue queries return empty results and MSG91 calls are logged but not sent.

---

## MSG91 Setup

### 1. Create your MSG91 account

Sign up at [msg91.com](https://msg91.com) and set up a WhatsApp Business API account.

### 2. Configure your WhatsApp number

In MSG91 dashboard → WhatsApp → Settings → configure your business number.

### 3. Set up the webhook

In MSG91 dashboard → WhatsApp → Webhooks:

- **URL**: `https://yourdomain.com/webhooks/whatsapp`
- **Events**: All message events (incoming, delivery receipts)
- **Secret**: Copy to `MSG91_WEBHOOK_SECRET` in `.env`

### 4. Verify credentials

```bash
# In .env:
MSG91_AUTH_KEY=your_actual_auth_key
MSG91_WHATSAPP_NUMBER=919XXXXXXXXX   # E.164 without +
MSG91_NAMESPACE=your_namespace
MSG91_WEBHOOK_SECRET=your_webhook_secret
```

### 5. Template messages

For outbound messages outside the 24-hour session window, you need pre-approved templates.  
Submit templates in MSG91 dashboard → WhatsApp → Templates.

Required templates (based on spec):
- `welcome_returning` — Re-engagement for returning customers
- `quote_followup` — Quote follow-up (only when consent is valid)
- `order_update` — Order status notification
- `ticket_acknowledgement` — Ticket confirmation

---

## Catalogue Integration

The catalogue service uses a provider pattern. Set `CATALOGUE_PROVIDER` in `.env`:

### Mock (default — no setup needed)

Returns static categories, empty product searches. Used for development.

### WooCommerce

```env
CATALOGUE_PROVIDER=woocommerce
WOOCOMMERCE_BASE_URL=https://yourstore.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxx
```

Then implement `apps/api/src/services/catalogue/catalogueService.js` → `woocommerceProvider`.

### Shopify

```env
CATALOGUE_PROVIDER=shopify
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxx
```

### Custom API

```env
CATALOGUE_PROVIDER=custom
CATALOGUE_API_BASE_URL=https://api.yourstore.com
CATALOGUE_API_KEY=your_key
```

Implement `customProvider` in `catalogueService.js`.

> **Important**: The bot never hard-codes prices, stock or availability. If the catalogue is unreachable, it tells the customer the team will confirm — never fabricates data.

---

## Conversation Flows

| Flow | Entry | Key actions |
|---|---|---|
| `welcome` | Any first message or MENU | Shows interactive main menu |
| `browse_products` | "Browse Products" | Multi-category selection with quantity |
| `bulk_enquiry` | "Bulk Office Requirement" | 8-step company + product collection |
| `quote` | "Get a Quote" | Items + PIN + billing + date → quote record |
| `pricing` | "Availability & Pricing" | Live catalogue lookup, honest fallback |
| `delivery` | "Delivery & Installation" | PIN + sub-type → team confirmation |
| `order_tracking` | "Track My Order" | Auth-gated order lookup |
| `invoice` | "Invoice / GST Details" | Ticket creation, identity verification |
| `complaint` | "Returns / Warranty / Complaint" | 6 issue types → ticket |
| `support` / `human_handoff` | "Talk to Sales / Support" or HUMAN | Human takeover with conversation lock |

---

## Multi-Selection Flow

This is the core UX pattern. WhatsApp does not support native multi-select, so the bot uses a repeated single-select conversation loop:

```
BOT: What are you looking for?
     [Office Chairs] [Office Desks] [Workstations] [Storage] [Accessories] ...

CUSTOMER: [Office Chairs]

BOT: How many Office Chairs? (type number or Skip)

CUSTOMER: 50

BOT: ✓ Office Chairs added.
     Your selection: Office Chairs — 50
     [Add Another] [Done ✓]

CUSTOMER: [Add Another]

BOT: What else? (Office Chairs not shown — already selected)
     [Office Desks] [Workstations] [Storage] [Accessories] ...

CUSTOMER: [Office Desks]

BOT: How many Office Desks?

CUSTOMER: 20

BOT: ✓ Office Desks added.
     Your selection: Office Chairs — 50, Office Desks — 20
     [Add Another] [Done ✓]

CUSTOMER: [Done ✓]

BOT: 📋 Your Requirement
     1. Office Chairs — Qty: 50
     2. Office Desks — Qty: 20
     [Request a Quote] [Edit Selection] [Talk to Sales]
```

**Duplicate prevention**: already-selected categories are excluded from subsequent list messages.

---

## Human Takeover

When a human agent takes over:

1. Customer types `HUMAN` or selects "Talk to Sales / Support"
2. Bot creates a lead record and sets `conversation.owner = "HUMAN"`
3. **Bot stops auto-replying** — all inbound messages are still logged
4. Agent can see the conversation in the dashboard and send messages
5. Agent clicks "Release to Bot" in dashboard to restore bot ownership
6. `conversation.owner` returns to `"BOT"` and normal flow resumes

---

## Global Commands

These work at any point in any conversation:

| Command | Action |
|---|---|
| `MENU` | Return to main menu, reset flow |
| `BACK` | Go back one step |
| `SUPPORT` | Show support category menu |
| `HUMAN` | Request human agent |
| `STOP` | Immediately opt out of promotional messages |
| `HI` / `Hello` / `Hey` | Treated as MENU — shows welcome |

Commands are **case-insensitive** (`menu`, `MENU`, `Menu` all work).

---

## API Reference

All admin API routes require `X-API-Key: <your_admin_key>` header.

### Webhook

```
POST /webhooks/whatsapp
```
Receives MSG91 WhatsApp events. Validates signature, deduplicates, processes asynchronously.

### Leads

```
POST   /api/leads              Create a lead
GET    /api/leads              List leads (filter: status, leadType, deliveryPin)
GET    /api/leads/:leadId      Get a lead
PATCH  /api/leads/:leadId      Update lead (e.g. status, assignedTo)
```

### Quotes

```
POST   /api/quotes/request     Create a quote request
GET    /api/quotes             List quotes (filter: status, assignedTo)
GET    /api/quotes/:quoteId    Get a quote
PATCH  /api/quotes/:quoteId    Update quote (sales team sets prices, status)
```

### Support Tickets

```
POST   /api/support/tickets            Create a ticket
GET    /api/support/tickets            List tickets (filter: status, category)
GET    /api/support/tickets/:ticketId  Get a ticket
PATCH  /api/support/tickets/:ticketId  Update ticket
```

### Catalogue

```
GET    /api/catalog/categories         List product categories (public)
GET    /api/catalog/products?q=chairs  Search products (public)
```

### Orders

```
GET    /api/orders/:orderId    Admin order lookup
```

### Conversations

```
GET    /api/conversations              List conversations
POST   /api/conversations/:id/takeover Take over (human)
POST   /api/conversations/:id/release  Release to bot
```

### Messages

```
POST   /api/messages/send    { to, text }   Send a message as agent
```

### Analytics

```
GET    /api/dashboard/stats   Summary counts for dashboard
```

### Health

```
GET    /health    { status: "ok", timestamp: "..." }
```

---

## Webhook Payloads

### Sample incoming text message (MSG91)

```json
{
  "data": {
    "id": "wamid.HBgLOTE5876543210VgIAERgSM2FGRUENFEBNQ==",
    "from": "919876543210",
    "type": "text",
    "timestamp": 1700000000,
    "text": { "body": "MENU" },
    "contacts": [{ "profile": { "name": "Raj Kumar" } }]
  }
}
```

### Sample interactive list_reply

```json
{
  "data": {
    "id": "wamid.abc123",
    "from": "919876543210",
    "type": "interactive",
    "timestamp": 1700000001,
    "interactive": {
      "type": "list_reply",
      "list_reply": {
        "id": "cat_office_chairs",
        "title": "Office Chairs"
      }
    }
  }
}
```

### Sample interactive button_reply

```json
{
  "data": {
    "id": "wamid.def456",
    "from": "919876543210",
    "type": "interactive",
    "timestamp": 1700000002,
    "interactive": {
      "type": "button_reply",
      "button_reply": {
        "id": "done_selection",
        "title": "Done ✓"
      }
    }
  }
}
```

### Test the webhook locally

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "id": "test-msg-001",
      "from": "919876543210",
      "type": "text",
      "timestamp": 1700000000,
      "text": { "body": "hi" },
      "contacts": [{ "profile": { "name": "Test User" } }]
    }
  }'
```

---

## Admin Dashboard

The React dashboard (`apps/web`) provides:

| Page | Features |
|---|---|
| Dashboard | Stats: conversations, leads, quotes, tickets, opt-outs; quick links; system status |
| Conversations | Live list; filter by owner (BOT/HUMAN) and status; takeover / release; agent message send |
| Leads | Filter by status and type; detail panel; status update |
| Quotes | Review queue; line items; status update (sales team workflow) |
| Tickets | Category and status filters; timeline view; status update |

**Environment for dashboard:**

```bash
# apps/web/.env (create this file)
VITE_API_BASE_URL=http://localhost:3000
VITE_ADMIN_API_KEY=your_admin_api_key
```

---

## Testing

```bash
cd apps/api

# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

Test coverage includes:
- Webhook signature validation (valid, tampered, wrong secret, missing)
- Global command detection (case-insensitive, all commands, non-commands)
- Multi-selection flow (category selection, quantity, add another, done, duplicate exclusion)
- Lead/quote/ticket service (ID generation, field mapping, status defaults)
- Conversation engine (deduplication, HUMAN ownership lock, command routing, error recovery)
- Webhook endpoint integration (200 acknowledgement, async processing, interactive events)

---

## Deployment

### Docker Compose (recommended)

```bash
cp .env.example .env
# Fill in all production values

docker-compose up -d
```

Services:
- `mongodb` — MongoDB 7 on port 27017
- `api` — Node.js API on port 3000
- `web` — Nginx serving React app on port 80

### Manual deployment

```bash
# API
cd apps/api
NODE_ENV=production npm start

# Web (build once, serve with nginx/CDN)
cd apps/web
npm run build
# Serve dist/ folder
```

### Production checklist

- [ ] `NODE_ENV=production` in environment
- [ ] `MONGODB_URI` points to a secured Atlas or self-hosted MongoDB with auth
- [ ] `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_NUMBER`, `MSG91_WEBHOOK_SECRET` configured
- [ ] `ADMIN_API_KEY` is a long random string (≥32 chars)
- [ ] `JWT_SECRET` is a long random string (≥32 chars)
- [ ] HTTPS/TLS is terminated at your load balancer or nginx
- [ ] `CATALOGUE_PROVIDER` set to your actual platform
- [ ] MongoDB is not publicly accessible
- [ ] Dashboard is behind authentication (reverse proxy + basic auth or VPN)
- [ ] Run `npm test` and confirm all tests pass before deploying
- [ ] Complete UAT with test phone numbers before going live

---

## Security Notes

- **Webhook signature**: All incoming webhooks are validated with HMAC-SHA256. In production, `MSG91_WEBHOOK_SECRET` must be set.
- **Deduplication**: Every message is stored by `providerMessageId` with a unique index. Duplicate webhooks are dropped before processing.
- **Human ownership lock**: When `conversation.owner = "HUMAN"`, the bot never auto-replies. Inbound messages are still logged for agents.
- **STOP compliance**: `STOP` command immediately sets opt-out status and suppresses all further promotional messaging.
- **Order auth**: Order details are never revealed without matching the requesting WhatsApp number to the order's registered contact.
- **No price hallucination**: Prices, stock and delivery are never hard-coded or invented. The bot always defers to the live catalogue or team confirmation.
- **PII in logs**: The logger automatically redacts fields matching: `password`, `otp`, `cvv`, `token`, `secret`, `authKey`, `banking`, `credential`.
- **Rate limiting**: Webhook endpoint: 120 req/min. API: 60 req/min. Configurable via env.
- **Never request**: OTPs, PINs, passwords, CVV or banking credentials — documented in all relevant flows.

---

## Integration Points

These require configuration before going live:

| System | File to update | Env vars |
|---|---|---|
| MSG91 WhatsApp | Already implemented | `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_NUMBER`, `MSG91_WEBHOOK_SECRET` |
| Catalogue (WooCommerce) | `services/catalogue/catalogueService.js` → `woocommerceProvider` | `WOOCOMMERCE_*` |
| Catalogue (Shopify) | `services/catalogue/catalogueService.js` → `shopifyProvider` | `SHOPIFY_*` |
| Catalogue (Custom) | `services/catalogue/catalogueService.js` → `customProvider` | `CATALOGUE_API_*` |
| Order system | `services/orders/orderService.js` → `customProvider` | `ORDER_API_*` |
| CRM | `services/leads/leadsService.js` — add CRM push in `createLead` | `CRM_API_*` |

---

## Decisions Required from Officerestore

Before going live, confirm:

1. **Commerce platform** — WooCommerce, Shopify or custom? (sets `CATALOGUE_PROVIDER`)
2. **Category/product URLs** — canonical product page URLs for the bot to share
3. **SKU search support** — does the catalogue support SKU lookup?
4. **Delivery/PIN coverage** — which PIN codes are serviceable?
5. **Return/warranty policy** — exact policy wording for bot to reference
6. **CRM/sales queue** — where do leads go? (Freshsales, Zoho, custom?)
7. **Order auth method** — how to verify a customer owns an order?
8. **MSG91 WhatsApp number** — approved number, templates submitted?
9. **Support hours** — for `SUPPORT_HOURS` env var
10. **UAT owner** — who runs acceptance testing with test WhatsApp numbers?
