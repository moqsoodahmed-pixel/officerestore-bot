const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'dev_admin_key';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Dashboard
  getStats: () => apiFetch('/api/dashboard/stats'),

  // Leads
  getLeads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/leads${qs ? `?${qs}` : ''}`);
  },
  getLead: (id) => apiFetch(`/api/leads/${id}`),
  updateLead: (id, data) => apiFetch(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Quotes
  getQuotes: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/quotes${qs ? `?${qs}` : ''}`);
  },
  getQuote: (id) => apiFetch(`/api/quotes/${id}`),
  updateQuote: (id, data) => apiFetch(`/api/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Tickets
  getTickets: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/support/tickets${qs ? `?${qs}` : ''}`);
  },
  getTicket: (id) => apiFetch(`/api/support/tickets/${id}`),
  updateTicket: (id, data) =>
    apiFetch(`/api/support/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Conversations
  getConversations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/conversations${qs ? `?${qs}` : ''}`);
  },
  takeoverConversation: (id, agentId) =>
    apiFetch(`/api/conversations/${id}/takeover`, { method: 'POST', body: JSON.stringify({ agentId }) }),
  releaseConversation: (id) =>
    apiFetch(`/api/conversations/${id}/release`, { method: 'POST' }),

  // Messages
  sendMessage: (to, text) =>
    apiFetch('/api/messages/send', { method: 'POST', body: JSON.stringify({ to, text }) }),
};
