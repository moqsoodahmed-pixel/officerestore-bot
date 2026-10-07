const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const KEY_STORAGE = 'officerestore_admin_key';

// The admin key is entered on the login screen and kept in this browser only.
// It is NOT baked into the website build, so the dashboard URL alone is useless.
export function getAdminKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}
export function setAdminKey(key) {
  try { localStorage.setItem(KEY_STORAGE, key); } catch { /* ignore */ }
}
export function clearAdminKey() {
  try { localStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ }
}

async function apiFetch(path, options = {}, keyOverride) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': keyOverride ?? getAdminKey(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    if (!keyOverride) {
      clearAdminKey();
      window.dispatchEvent(new Event('officerestore:logout'));
    }
    throw new Error('Admin key is incorrect. Please sign in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

const qs = (params = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : '';
};

export const api = {
  // Login check
  verifyKey: (key) => apiFetch('/api/dashboard/stats', {}, key),

  // Dashboard
  getStats: () => apiFetch('/api/dashboard/stats'),

  // Leads
  getLeads: (params = {}) => apiFetch(`/api/leads${qs(params)}`),
  getLead: (id) => apiFetch(`/api/leads/${id}`),
  updateLead: (id, data) => apiFetch(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Quotes
  getQuotes: (params = {}) => apiFetch(`/api/quotes${qs(params)}`),
  getQuote: (id) => apiFetch(`/api/quotes/${id}`),
  updateQuote: (id, data) => apiFetch(`/api/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Tickets
  getTickets: (params = {}) => apiFetch(`/api/support/tickets${qs(params)}`),
  getTicket: (id) => apiFetch(`/api/support/tickets/${id}`),
  updateTicket: (id, data) =>
    apiFetch(`/api/support/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Conversations
  getConversations: (params = {}) => apiFetch(`/api/conversations${qs(params)}`),
  getConversationMessages: (id) => apiFetch(`/api/conversations/${id}/messages`),
  takeoverConversation: (id, agentId) =>
    apiFetch(`/api/conversations/${id}/takeover`, { method: 'POST', body: JSON.stringify({ agentId }) }),
  releaseConversation: (id) =>
    apiFetch(`/api/conversations/${id}/release`, { method: 'POST' }),

  // Messages
  sendMessage: (to, text) =>
    apiFetch('/api/messages/send', { method: 'POST', body: JSON.stringify({ to, text }) }),
};