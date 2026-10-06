'use strict';

const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Catalogue service abstraction.
 * Loads the correct provider adapter based on CATALOGUE_PROVIDER env var.
 *
 * All provider adapters must implement the same interface:
 *   - getCategories()
 *   - searchProducts(query, categoryKey?)
 *   - getProduct(productId)
 *   - getProductByUrl(url)
 *
 * The bot NEVER hard-codes prices, stock or availability.
 * If the catalogue is unavailable, honest fallback messages are used.
 */

// ─── Mock Provider (for development without a real catalogue) ─────────────────

const MOCK_CATEGORIES = [
  { key: 'office_chairs', label: 'Office Chairs', emoji: '🪑', displayOrder: 1 },
  { key: 'office_desks', label: 'Office Desks & Tables', emoji: '🖥️', displayOrder: 2 },
  { key: 'workstations', label: 'Workstations', emoji: '💼', displayOrder: 3 },
  { key: 'storage', label: 'Storage & Cabinets', emoji: '🗄️', displayOrder: 4 },
  { key: 'accessories', label: 'Office Accessories', emoji: '📎', displayOrder: 5 },
  { key: 'complete_setup', label: 'Complete Office Setup', emoji: '🏢', displayOrder: 6 },
  { key: 'something_else', label: 'Something Else', emoji: '💬', displayOrder: 7 },
];

const mockProvider = {
  async getCategories() {
    return MOCK_CATEGORIES;
  },

  async searchProducts(query, categoryKey) {
    logger.info('[MOCK] catalogueService.searchProducts', { query, categoryKey });
    // Return empty — bot will tell customer the team will confirm
    return [];
  },

  async getProduct(productId) {
    logger.info('[MOCK] catalogueService.getProduct', { productId });
    return null;
  },

  async getProductByUrl(url) {
    logger.info('[MOCK] catalogueService.getProductByUrl', { url });
    return null;
  },
};

// ─── WooCommerce Adapter (stub — wire up when credentials are provided) ───────

const woocommerceProvider = {
  async getCategories() {
    // TODO: GET {baseUrl}/wp-json/wc/v3/products/categories
    // using Basic auth with consumer key/secret
    throw new Error('WooCommerce provider not yet configured');
  },
  async searchProducts() { throw new Error('WooCommerce provider not yet configured'); },
  async getProduct() { throw new Error('WooCommerce provider not yet configured'); },
  async getProductByUrl() { throw new Error('WooCommerce provider not yet configured'); },
};

// ─── Shopify Adapter (stub) ───────────────────────────────────────────────────

const shopifyProvider = {
  async getCategories() {
    // TODO: GET https://{domain}/admin/api/2024-01/custom_collections.json
    // Authorization: Bearer {access_token}
    throw new Error('Shopify provider not yet configured');
  },
  async searchProducts() { throw new Error('Shopify provider not yet configured'); },
  async getProduct() { throw new Error('Shopify provider not yet configured'); },
  async getProductByUrl() { throw new Error('Shopify provider not yet configured'); },
};

// ─── Custom API Adapter (stub) ────────────────────────────────────────────────

const customProvider = {
  async getCategories() {
    // TODO: GET {CATALOGUE_API_BASE_URL}/categories
    // Authorization: Bearer {CATALOGUE_API_KEY}
    throw new Error('Custom catalogue provider not yet configured');
  },
  async searchProducts() { throw new Error('Custom catalogue provider not yet configured'); },
  async getProduct() { throw new Error('Custom catalogue provider not yet configured'); },
  async getProductByUrl() { throw new Error('Custom catalogue provider not yet configured'); },
};

// ─── Provider loader ──────────────────────────────────────────────────────────

function getProvider() {
  switch (config.catalogue.provider) {
    case 'woocommerce': return woocommerceProvider;
    case 'shopify': return shopifyProvider;
    case 'custom': return customProvider;
    default: return mockProvider;
  }
}

// ─── Public API (always goes through provider) ────────────────────────────────

async function getCategories() {
  try {
    return await getProvider().getCategories();
  } catch (err) {
    logger.warn('Catalogue getCategories failed', { error: err.message });
    return MOCK_CATEGORIES; // fall back to static list so bot isn't broken
  }
}

async function searchProducts(query, categoryKey) {
  try {
    return await getProvider().searchProducts(query, categoryKey);
  } catch (err) {
    logger.warn('Catalogue searchProducts failed', { error: err.message });
    return [];
  }
}

async function getProduct(productId) {
  try {
    return await getProvider().getProduct(productId);
  } catch (err) {
    logger.warn('Catalogue getProduct failed', { error: err.message, productId });
    return null;
  }
}

async function getProductByUrl(url) {
  try {
    return await getProvider().getProductByUrl(url);
  } catch (err) {
    logger.warn('Catalogue getProductByUrl failed', { error: err.message });
    return null;
  }
}

module.exports = { getCategories, searchProducts, getProduct, getProductByUrl, MOCK_CATEGORIES };
